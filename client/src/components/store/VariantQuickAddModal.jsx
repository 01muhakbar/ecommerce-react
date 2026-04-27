import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, ShoppingCart, X } from "lucide-react";
import { useCart } from "../../hooks/useCart.ts";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import { formatCurrency } from "../../utils/format.js";
import { ensureProductImageUrl } from "../../utils/productImage.js";
import {
  buildPublicProductVariationGroups,
  normalizePublicProductVariationState,
  resolvePublicSelectedVariant,
} from "../../utils/publicProductVariations.js";

const toSafeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function VariantQuickAddModal({
  open,
  onClose,
  product,
  fallbackImageSrc = "",
}) {
  const { add, isLoading } = useCart();
  const [selectedOptions, setSelectedOptions] = useState({});
  const [qty, setQty] = useState(1);

  const variationState = useMemo(
    () => normalizePublicProductVariationState(product?.variations),
    [product?.variations]
  );
  const variationGroups = useMemo(
    () => buildPublicProductVariationGroups(product?.variations),
    [product?.variations]
  );
  const selectedVariant = useMemo(
    () => resolvePublicSelectedVariant(product?.variations, selectedOptions),
    [product?.variations, selectedOptions]
  );

  const selectedVariantPrice = toSafeNumber(selectedVariant?.price ?? product?.price, 0);
  const selectedVariantSalePrice = toSafeNumber(
    selectedVariant?.salePrice ??
      selectedVariant?.price ??
      product?.salePrice ??
      product?.price,
    0
  );
  const selectedVariantStockValue = Number(selectedVariant?.quantity ?? product?.stock);
  const selectedVariantHasFiniteStock = Number.isFinite(selectedVariantStockValue);
  const selectedVariantHasStock = selectedVariantHasFiniteStock ? selectedVariantStockValue > 0 : true;
  const purchaseState = product?.purchaseState || null;
  const isPurchasable =
    typeof purchaseState?.isPurchasable === "boolean"
      ? purchaseState.isPurchasable &&
        (!variationState.hasVariants || Boolean(selectedVariant)) &&
        selectedVariantHasStock
      : (!variationState.hasVariants || Boolean(selectedVariant)) && selectedVariantHasStock;
  const productName = product?.name || product?.title || "Product";
  const modalImageSrc = resolveAssetUrl(
    ensureProductImageUrl(selectedVariant?.image || fallbackImageSrc || "")
  );

  useEffect(() => {
    if (!open) return;
    setQty(1);
    if (variationGroups.length === 0) {
      setSelectedOptions({});
      return;
    }
    setSelectedOptions((prev) => {
      const next = {};
      variationGroups.forEach((group) => {
        const existing = prev[group.id];
        const hasExisting = group.options.some((option) => option.selectionKey === existing);
        next[group.id] = hasExisting ? existing : group.options[0]?.selectionKey ?? "";
      });
      return next;
    });
  }, [open, variationGroups]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!selectedVariantHasFiniteStock) return;
    if (selectedVariantStockValue <= 0) {
      setQty(1);
      return;
    }
    setQty((prev) => Math.min(Math.max(1, prev), selectedVariantStockValue));
  }, [selectedVariantHasFiniteStock, selectedVariantStockValue]);

  if (!open || !product) return null;
  if (typeof document === "undefined") return null;

  const selectionMessage =
    variationState.hasVariants && !selectedVariant
      ? "Choose a valid variant before adding this product to the cart."
      : !selectedVariantHasStock
        ? "This variant is currently out of stock."
        : "";

  const handleAddToCart = () => {
    if (!product?.id || !isPurchasable) return;
    add(product.id, qty, {
      name: product?.name || product?.title,
      price: selectedVariantSalePrice,
      imageUrl: modalImageSrc || fallbackImageSrc || null,
      variantKey: selectedVariant?.combinationKey || null,
      variantLabel: selectedVariant?.combination || null,
      variantSelections: selectedVariant?.selections || [],
      variantSku: selectedVariant?.sku || null,
      variantBarcode: selectedVariant?.barcode || null,
      variantPrice: selectedVariantPrice,
      variantSalePrice: selectedVariantSalePrice,
      variantImage: modalImageSrc || fallbackImageSrc || null,
      stock: selectedVariant?.quantity ?? null,
    });
    onClose?.();
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Select ${productName} variant`}
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-[560px] overflow-hidden rounded-[28px] border border-[#e8dccd] bg-white shadow-[0_28px_60px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#f0e7db] px-5 py-4 sm:px-6">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#df7f00]">
              Quick Variant Select
            </p>
            <h3 className="text-lg font-bold text-slate-900 sm:text-xl">{productName}</h3>
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="Close variant popup"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="grid gap-5 px-5 py-5 sm:px-6 md:grid-cols-[180px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-[22px] border border-[#f0e7db] bg-[#fcfaf7]">
            <div className="aspect-square w-full">
              {modalImageSrc ? (
                <img
                  src={modalImageSrc}
                  alt={productName}
                  className="h-full w-full object-contain p-5"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <ShoppingCart className="h-10 w-10" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-3">
                <span className="text-3xl font-extrabold tracking-[-0.03em] text-slate-900">
                  {formatCurrency(selectedVariantSalePrice)}
                </span>
                {selectedVariantPrice > selectedVariantSalePrice ? (
                  <span className="pb-1 text-sm text-slate-400 line-through">
                    {formatCurrency(selectedVariantPrice)}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                {selectedVariant?.combination ? (
                  <span className="rounded-full border border-[#f0e7db] bg-[#faf8f4] px-2.5 py-1 font-medium text-slate-700">
                    {selectedVariant.combination}
                  </span>
                ) : null}
                <span>
                  Stock:{" "}
                  {selectedVariantHasFiniteStock ? Math.max(0, selectedVariantStockValue) : "Available"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {variationGroups.map((group) => (
                <div key={group.id} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {group.label}
                    </p>
                    <span className="text-xs text-slate-500">
                      {group.options.find(
                        (option) => option.selectionKey === selectedOptions[group.id]
                      )?.value || "-"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((option) => {
                      const active = selectedOptions[group.id] === option.selectionKey;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            setSelectedOptions((prev) => ({
                              ...prev,
                              [group.id]: option.selectionKey,
                            }))
                          }
                          className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                            active
                              ? "border-[#df7f00] bg-[#df7f00] text-white"
                              : "border-[#ece7df] bg-white text-slate-700 hover:border-[#e7d5c1] hover:bg-[#faf8f4]"
                          }`}
                        >
                          {option.value}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-3 border-t border-[#f0e7db] pt-4">
              <div className="flex items-center gap-3">
                <div className="grid h-12 w-[132px] grid-cols-3 overflow-hidden rounded-2xl border border-[#dfd6cb] bg-white">
                  <button
                    type="button"
                    disabled={!isPurchasable || qty <= 1}
                    onClick={() => setQty((prev) => Math.max(1, prev - 1))}
                    className="inline-flex items-center justify-center border-r border-[#dfd6cb] text-slate-600 transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="inline-flex items-center justify-center text-base font-semibold text-slate-900">
                    {qty}
                  </span>
                  <button
                    type="button"
                    disabled={
                      !isPurchasable ||
                      (selectedVariantHasFiniteStock && qty >= selectedVariantStockValue)
                    }
                    onClick={() =>
                      setQty((prev) =>
                        selectedVariantHasFiniteStock
                          ? Math.min(selectedVariantStockValue, prev + 1)
                          : prev + 1
                      )
                    }
                    className="inline-flex items-center justify-center border-l border-[#dfd6cb] text-slate-600 transition hover:bg-[#faf8f4] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={!isPurchasable || isLoading}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <ShoppingCart className="h-4.5 w-4.5" />
                  <span>{isPurchasable ? "Add to Cart" : purchaseState?.label || "Unavailable"}</span>
                </button>
              </div>
              {selectionMessage ? (
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                  {selectionMessage}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
