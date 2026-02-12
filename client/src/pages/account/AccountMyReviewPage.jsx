import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchStoreMyOrders, fetchStoreOrder } from "../../api/store.service.ts";
import { fetchMyReviews, upsertReviewByProduct } from "../../api/reviews.service.ts";
import ReviewModal from "../../components/account/ReviewModal.jsx";
import { resolveProductImageUrl } from "../../utils/productImage.js";

const PAGE_SIZE = 16;

const ResolvedImage = ({ product, alt, className, fallback }) => {
  const resolvedSrc = useMemo(() => resolveProductImageUrl(product), [product]);
  const [src, setSrc] = useState(resolvedSrc);

  useEffect(() => {
    setSrc(resolvedSrc);
  }, [resolvedSrc]);

  if (!src) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setSrc("")}
    />
  );
};

const getOrderRef = (order) =>
  order?.invoiceNo || order?.invoice || order?.ref || order?.orderId || order?.id;

const getProductFromItem = (item) => {
  const productId = Number(item?.productId ?? item?.id ?? item?.product_id);
  if (!Number.isFinite(productId)) return null;
  return {
    id: productId,
    name: item?.name || `Product #${productId}`,
    imageUrl: item?.imageUrl ?? item?.image ?? item?.thumbnail ?? null,
  };
};

export default function AccountMyReviewPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("need");
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const [products, setProducts] = useState([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [modalState, setModalState] = useState({
    open: false,
    product: null,
    review: null,
  });

  const {
    data: ordersData,
    isLoading: isLoadingOrders,
    isError: isOrdersError,
    error: ordersError,
  } = useQuery({
    queryKey: ["account", "orders", "my", "review"],
    queryFn: () => fetchStoreMyOrders(),
  });

  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    isError: isReviewsError,
    error: reviewsError,
  } = useQuery({
    queryKey: ["account", "reviews", "my"],
    queryFn: () => fetchMyReviews(),
  });

  const orders = Array.isArray(ordersData?.data)
    ? ordersData.data
    : Array.isArray(ordersData)
      ? ordersData
      : [];

  const reviews = Array.isArray(reviewsData?.data)
    ? reviewsData.data
    : Array.isArray(reviewsData)
      ? reviewsData
      : [];

  useEffect(() => {
    let active = true;
    const loadProducts = async () => {
      setIsLoadingProducts(true);
      const refs = orders
        .map(getOrderRef)
        .filter(Boolean)
        .map(String);
      const uniqueRefs = Array.from(new Set(refs));
      if (uniqueRefs.length === 0) {
        if (active) {
          setProducts([]);
          setIsLoadingProducts(false);
        }
        return;
      }
      const results = await Promise.allSettled(
        uniqueRefs.map((ref) => fetchStoreOrder(ref))
      );
      const productMap = new Map();
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        const payload = result.value?.data ?? result.value;
        const items = Array.isArray(payload?.items) ? payload.items : [];
        items.forEach((item) => {
          const product = getProductFromItem(item);
          if (!product || productMap.has(product.id)) return;
          productMap.set(product.id, product);
        });
      });
      if (active) {
        setProducts(Array.from(productMap.values()));
        setIsLoadingProducts(false);
      }
    };
    loadProducts();
    return () => {
      active = false;
    };
  }, [orders]);

  const productIndex = useMemo(() => {
    const map = new Map();
    products.forEach((product) => {
      map.set(product.id, product);
    });
    return map;
  }, [products]);

  const reviewMap = useMemo(() => {
    const map = new Map();
    reviews.forEach((review) => {
      if (review?.productId) {
        map.set(review.productId, review);
      }
    });
    return map;
  }, [reviews]);

  const reviewedIds = useMemo(() => new Set(reviewMap.keys()), [reviewMap]);

  const reviewedProducts = useMemo(() => {
    return reviews.map((review) => {
      const productId = Number(review.productId);
      const base = productIndex.get(productId) || {};
      const product = review.product || {};
      return {
        id: productId,
        name: product.name || base.name || `Product #${productId}`,
        imageUrl: product.imageUrl || base.imageUrl || null,
        review,
      };
    });
  }, [reviews, productIndex]);

  const needToReview = useMemo(() => {
    return products.filter((product) => !reviewedIds.has(product.id));
  }, [products, reviewedIds]);

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
    updatePage(1);
  };

  const handleOpenModal = (product) => {
    const review = reviewMap.get(product.id) || null;
    setModalState({ open: true, product, review });
  };

  const handleCloseModal = () => {
    setSubmitError("");
    setModalState({ open: false, product: null, review: null });
  };

  const handleSaveReview = async (payload) => {
    if (!modalState.product) return;
    setSubmitError("");
    try {
      await upsertReviewByProduct(modalState.product.id, {
        rating: payload.rating,
        comment: payload.comment,
        images: payload.images || [],
      });
      await queryClient.invalidateQueries({
        queryKey: ["account", "reviews", "my"],
      });
      handleCloseModal();
    } catch (err) {
      setSubmitError(err?.response?.data?.message || "Failed to submit review.");
    }
  };

  const showEmptyState =
    !isLoadingOrders &&
    !isLoadingProducts &&
    !isLoadingReviews &&
    !isOrdersError &&
    !isReviewsError &&
    currentList.length === 0;

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

      {isLoadingOrders || isLoadingProducts || isLoadingReviews ? (
        <div className="py-10 text-sm text-slate-500">Loading reviews...</div>
      ) : isOrdersError || isReviewsError ? (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          {ordersError?.response?.status === 401 ||
          reviewsError?.response?.status === 401 ? (
            <>
              Please login.{" "}
              <Link
                to="/auth/login"
                className="font-medium text-rose-700 underline"
              >
                Go to login
              </Link>
            </>
          ) : (
            "Failed to load orders."
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
            {pagedItems.map((product) => (
              activeTab === "need" ? (
                <div
                  key={product.id}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-4"
                >
                  <ResolvedImage
                    product={product}
                    alt={product.name}
                    className="h-14 w-14 rounded-lg object-cover"
                    fallback={
                      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                      </div>
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {product.name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenModal(product)}
                    className="ml-auto inline-flex rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                  >
                    Write Review
                  </button>
                </div>
              ) : (
                <div
                  key={product.id}
                  className="flex flex-col items-center rounded-xl border border-slate-100 bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-slate-50 p-1">
                    <ResolvedImage
                      product={product}
                      alt={product.name}
                      className="h-full w-full rounded-xl object-cover"
                      fallback={<ImageIcon className="h-8 w-8 text-slate-300" />}
                    />
                  </div>
                  <p className="mt-4 line-clamp-1 text-sm font-semibold text-slate-800">
                    {product.name}
                  </p>
                  <div className="mt-2 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const ratingValue = Number(product.review?.rating || 0);
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
                  <button
                    type="button"
                    onClick={() => handleOpenModal(product)}
                    className="mt-2 text-sm font-medium text-emerald-600 transition hover:text-emerald-700"
                  >
                    Edit Review
                  </button>
                </div>
              )
            ))}
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

      <ReviewModal
        open={modalState.open}
        product={modalState.product}
        review={modalState.review}
        onClose={handleCloseModal}
        onSubmit={handleSaveReview}
      />
    </div>
  );
}
