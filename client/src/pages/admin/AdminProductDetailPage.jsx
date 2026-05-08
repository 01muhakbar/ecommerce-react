import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { fetchAdminProduct } from "../../lib/adminApi.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import {
  getProductVisibleImageUrls,
  getPrimaryProductImageUrl,
  normalizeProductDisplayTags,
} from "../../utils/productDisplay.js";
import { moneyIDR } from "../../utils/money.js";
import { buildAdminProductVariantRows } from "../../utils/adminProductVariations.js";

const FALLBACK_THUMBNAIL = "/demo/placeholder-product.svg";

const asNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getCategoryContext = (product) => {
  const selectedCategories = Array.isArray(product?.categories)
    ? product.categories.filter(Boolean)
    : [];
  const fallbackDefaultId = Number(product?.defaultCategoryId ?? product?.categoryId ?? 0);
  const defaultCategory =
    product?.defaultCategory ||
    product?.category ||
    selectedCategories.find((category) => Number(category?.id) === fallbackDefaultId) ||
    null;

  return {
    defaultCategory,
    selectedCategories,
  };
};

const getShowingMeta = (product) => {
  const published = Boolean(product?.published ?? product?.isPublished);
  const storefrontVisible =
    String(product?.visibility?.stateCode || "")
      .trim()
      .toUpperCase() === "STOREFRONT_VISIBLE";

  if (published && storefrontVisible) {
    return {
      label: "Showing",
      className: "bg-emerald-500 text-white",
    };
  }

  return {
    label: "Hidden",
    className: "bg-slate-200 text-slate-700",
  };
};

function AdminProductImageLightbox({
  images,
  activeIndex,
  onChangeIndex,
  onClose,
  productName,
}) {
  const activeImage = images[activeIndex] || "";

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && images.length > 1) {
        onChangeIndex((activeIndex - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight" && images.length > 1) {
        onChangeIndex((activeIndex + 1) % images.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, images.length, onChangeIndex, onClose]);

  if (!activeImage) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/92 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
        aria-label="Close image preview"
      >
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 ? (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChangeIndex((activeIndex - 1 + images.length) % images.length);
            }}
            className="absolute left-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChangeIndex((activeIndex + 1) % images.length);
            }}
            className="absolute right-4 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white transition hover:bg-white/15"
            aria-label="Next image"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      ) : null}
      <div
        className="flex max-h-full max-w-6xl flex-col items-center gap-4"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex max-h-[82vh] w-full items-center justify-center">
          <img
            src={activeImage}
            alt={productName || "Product image"}
            className="max-h-[82vh] max-w-full object-contain"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = FALLBACK_THUMBNAIL;
            }}
          />
        </div>
        {images.length > 1 ? (
          <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
            {images.map((image, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => onChangeIndex(index)}
                  className={`overflow-hidden rounded-2xl border transition ${
                    active
                      ? "border-white shadow-[0_0_0_2px_rgba(255,255,255,0.2)]"
                      : "border-white/15 opacity-70 hover:opacity-100"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${productName || "Product"} ${index + 1}`}
                    className="h-16 w-16 object-cover"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = FALLBACK_THUMBNAIL;
                    }}
                  />
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const detailQuery = useQuery({
    queryKey: ["admin-product-detail-page", id],
    queryFn: () => fetchAdminProduct(id),
    enabled: Boolean(id),
  });

  const product = detailQuery.data?.data || null;
  const imageUrl = resolveAssetUrl(getPrimaryProductImageUrl(product, FALLBACK_THUMBNAIL));
  const galleryImages = useMemo(() => {
    const images = getProductVisibleImageUrls(product)
      .map((value) => resolveAssetUrl(value))
      .filter(Boolean);
    return images.length > 0 ? images : [imageUrl || FALLBACK_THUMBNAIL];
  }, [imageUrl, product]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const price = asNumber(product?.price);
  const salePrice = asNumber(product?.salePrice);
  const hasSalePrice = salePrice > 0 && salePrice < price;
  const showingMeta = useMemo(() => getShowingMeta(product), [product]);
  const categoryContext = useMemo(() => getCategoryContext(product), [product]);
  const tags = useMemo(
    () =>
      normalizeProductDisplayTags(product?.tags, {
        filterInternal: true,
        maxLength: 32,
      }),
    [product?.tags]
  );
  const variantRows = useMemo(
    () => buildAdminProductVariantRows(product, imageUrl || FALLBACK_THUMBNAIL),
    [imageUrl, product]
  );

  useEffect(() => {
    setActiveImageIndex(0);
  }, [galleryImages]);

  const activeImage = galleryImages[activeImageIndex] || imageUrl || FALLBACK_THUMBNAIL;

  return (
    <div className="space-y-5 rounded-2xl bg-slate-50/70 p-4 md:p-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)] md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
              Product Details
            </h1>
          </div>
          <Link
            to="/admin/catalog/products"
            className="text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            Back to Products
          </Link>
        </div>
      </div>

      {detailQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
          Loading product details...
        </div>
      ) : detailQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
          {detailQuery.error?.response?.data?.message || "Failed to load product detail."}
        </div>
      ) : !product ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
          Product detail is not available.
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
            <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="space-y-3">
                  <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden rounded-xl bg-white">
                    {galleryImages.length > 1 ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIndex(
                              (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
                            )
                          }
                          className="absolute left-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setActiveImageIndex((prev) => (prev + 1) % galleryImages.length)
                          }
                          className="absolute right-3 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setIsImageLightboxOpen(true)}
                      className="group flex h-full w-full cursor-zoom-in items-center justify-center"
                      aria-label="Open product image fullscreen"
                    >
                      <img
                        src={activeImage}
                        alt={product.name || "Product image"}
                        onError={(event) => {
                          event.currentTarget.onerror = null;
                          event.currentTarget.src = FALLBACK_THUMBNAIL;
                        }}
                        className="max-h-[360px] w-full max-w-[260px] object-contain"
                      />
                      <span className="pointer-events-none absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                        Click to preview fullscreen
                      </span>
                    </button>
                  </div>
                  {galleryImages.length > 1 ? (
                    <div className="grid grid-cols-5 gap-2">
                      {galleryImages.slice(0, 5).map((image, index) => {
                        const active = index === activeImageIndex;
                        return (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            onClick={() => {
                              setActiveImageIndex(index);
                              setIsImageLightboxOpen(true);
                            }}
                            className={`aspect-square overflow-hidden rounded-2xl border bg-slate-50 transition ${
                              active
                                ? "border-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.18)]"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                            aria-label={`Show image ${index + 1}`}
                          >
                            <img
                              src={image}
                              alt={`${product.name || "Product"} ${index + 1}`}
                              className="h-full w-full object-cover"
                              onError={(event) => {
                                event.currentTarget.onerror = null;
                                event.currentTarget.src = FALLBACK_THUMBNAIL;
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[26px] font-semibold uppercase leading-tight text-slate-900 md:text-[34px]">
                      {product.name || "-"}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      Sku: <span className="font-medium text-slate-700">{product.sku || "-"}</span>
                    </p>
                  </div>
                  <span
                    className={`inline-flex min-h-7 items-center rounded-full px-4 py-1 text-xs font-semibold ${showingMeta.className}`}
                  >
                    {showingMeta.label}
                  </span>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <span className="text-3xl font-bold text-amber-600">
                    {moneyIDR(hasSalePrice ? salePrice : price)}
                  </span>
                  {hasSalePrice ? (
                    <span className="text-xl font-semibold text-slate-400 line-through">
                      {moneyIDR(price)}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                      Number(product.stock || 0) > 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {Number(product.stock || 0) > 0 ? "In Stock" : "Out of Stock"}
                  </span>
                  <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-1 text-xs font-semibold text-slate-600">
                    Quantity: {asNumber(product.stock)}
                  </span>
                </div>

                <p className="max-w-4xl text-base leading-8 text-slate-600">
                  {product.description || "-"}
                </p>

                <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Category
                    </p>
                    <p className="mt-3 text-lg font-medium text-slate-900">
                      {categoryContext.defaultCategory?.name || "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Tags
                    </p>
                    {tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-slate-500">No tags</p>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/catalog/products/${encodeURIComponent(String(product.id))}/edit`)}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 text-sm font-semibold text-white transition hover:bg-amber-600"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit Product
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_30px_-20px_rgba(15,23,42,0.35)]">
            <h3 className="text-2xl font-semibold text-slate-900">Product Variant List</h3>
            {variantRows.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
                No product variants configured for this product.
              </div>
            ) : (
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[980px] table-auto">
                    <thead className="bg-slate-100">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">SR</th>
                        <th className="px-4 py-3">IMAGE</th>
                        <th className="px-4 py-3">COMBINATION</th>
                        <th className="px-4 py-3">SKU</th>
                        <th className="px-4 py-3">BARCODE</th>
                        <th className="px-4 py-3">ORIGINAL PRICE</th>
                        <th className="px-4 py-3">SALE PRICE</th>
                        <th className="px-4 py-3">QUANTITY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantRows.map((variant) => (
                        <tr key={variant.id} className="border-t border-slate-200 text-sm text-slate-700">
                          <td className="px-4 py-3 font-medium">{variant.sr}</td>
                          <td className="px-4 py-3">
                            <div className="h-11 w-11 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                              <img
                                src={resolveAssetUrl(variant.imageUrl || FALLBACK_THUMBNAIL)}
                                alt={variant.combination}
                                onError={(event) => {
                                  event.currentTarget.onerror = null;
                                  event.currentTarget.src = FALLBACK_THUMBNAIL;
                                }}
                                className="h-full w-full object-contain p-1"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800">{variant.combination}</td>
                          <td className="px-4 py-3 text-slate-600">{variant.sku}</td>
                          <td className="px-4 py-3 text-slate-600">{variant.barcode}</td>
                          <td className="px-4 py-3 font-medium text-slate-700">
                            {moneyIDR(variant.originalPrice)}
                          </td>
                          <td className="px-4 py-3 font-medium text-emerald-600">
                            {moneyIDR(variant.salePrice)}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-700">{variant.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      {isImageLightboxOpen && galleryImages.length > 0 ? (
        <AdminProductImageLightbox
          images={galleryImages}
          activeIndex={activeImageIndex}
          onChangeIndex={setActiveImageIndex}
          onClose={() => setIsImageLightboxOpen(false)}
          productName={product?.name}
        />
      ) : null}
    </div>
  );
}
