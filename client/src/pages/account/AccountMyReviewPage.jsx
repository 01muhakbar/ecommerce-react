import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import {
  createReview,
  fetchMyReviewNeeds,
  fetchMyReviews,
  uploadReviewImage,
  updateReview,
} from "../../api/reviews.service.ts";
import ReviewModal from "../../components/account/ReviewModal.jsx";
import { resolveProductImageUrl } from "../../utils/productImage.js";
import {
  buildLoginRedirectState,
  REVIEWS_LOGIN_REQUIRED_NOTICE,
} from "../../auth/loginRedirectState.ts";

const PAGE_SIZE = 16;

const toDateLabel = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const normalizeReviewImages = (review) => {
  if (!Array.isArray(review?.images)) return [];
  return review.images
    .map((image) => String(image || "").trim())
    .filter(Boolean)
    .slice(0, 4);
};

const ResolvedImage = ({ product, alt, className, fallback }) => {
  const resolvedSrc = useMemo(() => resolveProductImageUrl(product), [product]);
  const [src, setSrc] = useState(resolvedSrc);

  useEffect(() => {
    setSrc(resolvedSrc);
  }, [resolvedSrc]);

  if (!src) return fallback;
  return <img src={src} alt={alt} className={className} onError={() => setSrc("")} />;
};

export default function AccountMyReviewPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("need");
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalState, setModalState] = useState({
    open: false,
    product: null,
    review: null,
  });

  const needQuery = useQuery({
    queryKey: ["account", "reviews", "need"],
    queryFn: () => fetchMyReviewNeeds(),
  });
  const reviewedQuery = useQuery({
    queryKey: ["account", "reviews", "reviewed"],
    queryFn: () => fetchMyReviews(),
  });

  const needToReview = Array.isArray(needQuery.data?.items) ? needQuery.data.items : [];
  const reviews = Array.isArray(reviewedQuery.data?.items) ? reviewedQuery.data.items : [];

  const reviewedProducts = useMemo(
    () =>
      reviews.map((review) => {
        const productId = Number(review?.productId);
        const fallbackName = Number.isFinite(productId)
          ? `Product #${productId}`
          : "Reviewed product";
        return {
          id: Number.isFinite(productId) ? productId : `review-${review?.id}`,
          productId: Number.isFinite(productId) ? productId : null,
          name: review?.product?.name || fallbackName,
          imageUrl: review?.product?.imageUrl || null,
          review,
        };
      }),
    [reviews]
  );

  const currentList = activeTab === "need" ? needToReview : reviewedProducts;
  const totalItems = currentList.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const pagedItems = currentList.slice(startIndex, startIndex + PAGE_SIZE);
  const startLabel = totalItems === 0 ? 0 : startIndex + 1;
  const endLabel = totalItems === 0 ? 0 : Math.min(totalItems, startIndex + PAGE_SIZE);

  const updatePage = (nextPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
  };

  useEffect(() => {
    if (page > totalPages) {
      updatePage(totalPages);
    }
  }, [page, totalPages]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 7;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
  }, [page, totalPages]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSubmitError("");
    setSubmitSuccess("");
    updatePage(1);
  };

  const handleOpenModal = (product, review = null) => {
    setSubmitError("");
    setSubmitSuccess("");
    setModalState({ open: true, product, review });
  };

  const handleCloseModal = () => {
    setModalState({ open: false, product: null, review: null });
  };

  const handleSaveReview = async (payload) => {
    if (!modalState.product?.productId && !modalState.product?.id) return;
    const productId = Number(modalState.product?.productId ?? modalState.product?.id);
    if (!Number.isFinite(productId)) return;

    setSubmitError("");
    setSubmitSuccess("");
    setIsSubmitting(true);
    try {
      const uploadedUrls =
        Array.isArray(payload?.newFiles) && payload.newFiles.length > 0
          ? await Promise.all(payload.newFiles.map((file) => uploadReviewImage(file)))
          : [];
      const existingImages = Array.isArray(payload?.existingImages)
        ? payload.existingImages
        : [];
      const images = [...existingImages, ...uploadedUrls].slice(0, 4);

      if (modalState.review?.id) {
        await updateReview(Number(modalState.review.id), {
          rating: payload.rating,
          comment: payload.comment,
          images,
        });
      } else {
        await createReview({
          productId,
          rating: payload.rating,
          comment: payload.comment,
          images,
        });
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account", "reviews", "need"] }),
        queryClient.invalidateQueries({ queryKey: ["account", "reviews", "reviewed"] }),
      ]);
      setActiveTab("reviewed");
      updatePage(1);
      handleCloseModal();
      setSubmitSuccess("Review submitted successfully.");
    } catch (err) {
      const status = err?.response?.status;
      const message =
        status === 409
          ? "You already reviewed this product."
          : err?.response?.data?.message || "Failed to submit review.";
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLoading =
    activeTab === "need" ? needQuery.isLoading : reviewedQuery.isLoading;
  const activeError = activeTab === "need" ? needQuery.error : reviewedQuery.error;
  const isActiveError = activeTab === "need" ? needQuery.isError : reviewedQuery.isError;
  const showEmptyState = !isLoading && !isActiveError && currentList.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="mb-6 flex items-center gap-8 border-b border-slate-200">
        <button
          type="button"
          onClick={() => handleTabChange("need")}
          className={`inline-flex pb-3 text-sm font-medium ${
            activeTab === "need"
              ? "border-b-2 border-emerald-600 text-emerald-700"
              : "text-slate-500"
          }`}
        >
          Need to Review
        </button>
        <button
          type="button"
          onClick={() => handleTabChange("reviewed")}
          className={`inline-flex pb-3 text-sm font-medium ${
            activeTab === "reviewed"
              ? "border-b-2 border-emerald-600 text-emerald-700"
              : "text-slate-500"
          }`}
        >
          Reviewed Products
        </button>
      </div>

      {isLoading ? (
        <div className="py-10 text-sm text-slate-500">Loading reviews...</div>
      ) : isActiveError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {activeError?.response?.status === 401 ? (
            <>
              Please login.{" "}
              <Link
                to="/auth/login"
                state={buildLoginRedirectState({
                  from: "/user/my-reviews",
                  authNotice: REVIEWS_LOGIN_REQUIRED_NOTICE,
                })}
                className="font-medium text-rose-700 underline"
              >
                Go to login
              </Link>
            </>
          ) : (
            "Failed to load reviews."
          )}
        </div>
      ) : showEmptyState ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-600">
          {activeTab === "need"
            ? "No products to review yet."
            : "No reviewed products yet."}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pagedItems.map((item) =>
              activeTab === "need" ? (
                <div
                  key={`${item.productId}-${item.orderId ?? "na"}`}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4"
                >
                  <ResolvedImage
                    product={item}
                    alt={item.name}
                    className="h-14 w-14 rounded-lg object-cover"
                    fallback={
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {item.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenModal(item)}
                    className="ml-auto inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Write Review
                  </button>
                </div>
              ) : (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50 p-1">
                      <ResolvedImage
                        product={item}
                        alt={item.name}
                        className="h-full w-full rounded-lg object-cover"
                        fallback={<ImageIcon className="h-8 w-8 text-slate-300" />}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold text-slate-800">
                        {item.name}
                      </p>
                      <div className="mt-2 flex items-center gap-1">
                        {Array.from({ length: 5 }).map((_, idx) => {
                          const ratingValue = Number(item.review?.rating || 0);
                          const active = idx + 1 <= ratingValue;
                          return (
                            <Star
                              key={idx}
                              className={`h-4 w-4 ${
                                active ? "text-yellow-400" : "text-slate-200"
                              }`}
                              fill={active ? "currentColor" : "none"}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 line-clamp-3 text-sm text-slate-600">
                    {item.review?.comment || "-"}
                  </p>
                  {normalizeReviewImages(item.review).length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {normalizeReviewImages(item.review).map((image, index) => (
                        <img
                          key={`${item.id}-${index}`}
                          src={image}
                          alt=""
                          className="h-12 w-12 rounded-md object-cover"
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src =
                              "data:image/gif;base64,R0lGODlhAQABAAAAACw=";
                          }}
                        />
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-400">
                      {toDateLabel(item.review?.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenModal(item, item.review)}
                      className="text-sm font-medium text-emerald-600 transition hover:text-emerald-700"
                    >
                      Edit Review
                    </button>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              SHOWING {startLabel}-{endLabel} OF {totalItems}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updatePage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {pageNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => updatePage(num)}
                  className={`flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold ${
                    num === page
                      ? "bg-emerald-600 text-white"
                      : "text-slate-700 hover:text-emerald-700"
                  }`}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => updatePage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 transition hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      {submitError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {submitError}
        </div>
      ) : null}
      {submitSuccess ? (
        <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {submitSuccess}
        </div>
      ) : null}

      <ReviewModal
        open={modalState.open}
        product={modalState.product}
        review={modalState.review}
        onClose={handleCloseModal}
        onSubmit={handleSaveReview}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
