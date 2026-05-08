import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShoppingCart, Trash2, X } from "lucide-react";
import { previewCheckoutByStore } from "../../api/public/storeCheckout.ts";
import { useCart } from "../../hooks/useCart.ts";
import { formatCurrency } from "../../utils/format.js";
import { getOrderItemVariantLines } from "../../utils/orderVariantPresentation.js";
import {
  findInvalidVariantCheckoutItem,
  resolveVariantCheckoutMessage,
} from "../../utils/variantCheckoutErrors.js";
import {
  UiEmptyState,
  UiErrorState,
  UiUpdatingBadge,
} from "../../components/primitives/state/index.js";
import { GENERIC_ERROR, UPDATING } from "../../constants/uiMessages.js";

const RECOVERY_RESELECT_CODES = new Set([
  "PRODUCT_VARIANT_REQUIRED",
  "PRODUCT_VARIANT_MISSING",
  "VARIANT_NOT_AVAILABLE",
]);

const resolveHasCheckoutAuthHint = () => {
  try {
    return (
      Boolean(localStorage.getItem("authToken")) ||
      localStorage.getItem("authSessionHint") === "true"
    );
  } catch {
    return false;
  }
};

const buildCartCheckoutSignature = (items) =>
  (Array.isArray(items) ? items : [])
    .map((item) => {
      const productId = Number(item?.productId ?? item?.id);
      const lineId =
        String(item?.lineId || "").trim() ||
        `${productId}:${String(item?.variantKey || "").trim().toLowerCase() || "base"}`;
      const qty = Math.max(0, Number(item?.quantity ?? item?.qty ?? 0));
      return `${lineId}:${qty}`;
    })
    .filter((value) => !value.startsWith(":"))
    .sort()
    .join("|");

const canReselectInvalidCartItem = (invalidItem) =>
  RECOVERY_RESELECT_CODES.has(String(invalidItem?.code || invalidItem?.reason || "").trim().toUpperCase());

const buildVariantRecoveryState = (item, invalidItem, sourcePath) => {
  const rawSelections =
    invalidItem?.meta?.variantSelections ??
    invalidItem?.variantSelections ??
    item?.variantSelections ??
    [];

  return {
    checkoutRecovery: {
      reason: String(invalidItem?.code || invalidItem?.reason || "").trim().toUpperCase() || null,
      productId: Number(item?.productId ?? invalidItem?.productId) || null,
      productName: String(item?.name || invalidItem?.productName || "").trim() || null,
      variantKey: invalidItem?.variantKey ?? item?.variantKey ?? null,
      variantSelections: Array.isArray(rawSelections) ? rawSelections : [],
      source: "cart",
      fromPath: sourcePath,
    },
  };
};

function useCartCheckoutPreflight(items, enabled) {
  const checkoutSignature = buildCartCheckoutSignature(items);
  const preflightQuery = useQuery({
    queryKey: ["cart-checkout-preflight", checkoutSignature],
    queryFn: () => previewCheckoutByStore(),
    enabled: enabled && Boolean(checkoutSignature),
    staleTime: 10_000,
    retry: false,
  });

  const invalidItems = Array.isArray(preflightQuery.data?.data?.invalidItems)
    ? preflightQuery.data.data.invalidItems.map((item) => ({
        ...item,
        message: resolveVariantCheckoutMessage(
          item,
          "This cart line needs attention before checkout."
        ),
      }))
    : [];

  return {
    invalidItems,
    hasInvalidItems: invalidItems.length > 0,
    isLoading: preflightQuery.isLoading,
    isError: preflightQuery.isError,
  };
}

const scrollToFirstCartInvalidItem = (selector) => {
  if (typeof document === "undefined") return;
  const target = document.querySelector(selector);
  if (target && typeof target.scrollIntoView === "function") {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }
};

export function StoreCartDrawer({
  isOpen = true,
  onClose,
  showBackdrop = true,
}) {
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);
  const {
    items,
    subtotal,
    hasHydrated,
    isLoading,
    error,
    update,
    remove,
    refreshCart,
    hasVariantItems,
  } = useCart();
  const hasItems = items.length > 0;
  const isInitialSyncing = hasHydrated && isLoading && !hasItems;
  const showSkeleton = !hasHydrated || isInitialSyncing;
  const isFatalError = Boolean(error) && !showSkeleton && !hasItems;
  const showInlineError = Boolean(error) && hasItems;
  const [shouldRender, setShouldRender] = useState(isOpen);
  const lastRefreshAtRef = useRef(0);
  const hasCheckoutAuthHint = resolveHasCheckoutAuthHint();
  const {
    invalidItems: checkoutPreflightInvalidItems,
    hasInvalidItems: hasCheckoutPreflightInvalidItems,
    isLoading: isCheckoutPreflightLoading,
  } = useCartCheckoutPreflight(
    items,
    hasHydrated && hasItems && !isLoading && hasCheckoutAuthHint
  );
  const subtotalValue = Number(subtotal || 0);
  const discountValue = 0;
  const shippingLabel = "Calculated at checkout";
  const taxLabel = "Calculated at checkout";
  const totalValue = subtotalValue;
  const errorMessage =
    resolveVariantCheckoutMessage(error, "") ||
    error?.response?.data?.message ||
    error?.message ||
    GENERIC_ERROR;

  useEffect(() => {
    if (!isOpen) return;
    const now = Date.now();
    const isStale = now - lastRefreshAtRef.current > 30_000;
    if (!hasHydrated || isStale || error) {
      lastRefreshAtRef.current = now;
      void refreshCart(false);
    }
  }, [error, hasHydrated, isOpen, refreshCart]);

  useLayoutEffect(() => {
    if (isOpen) setShouldRender(true);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    const timer = window.setTimeout(() => {
      setShouldRender(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (typeof onClose === "function") {
      onClose();
      return;
    }
    if (typeof window !== "undefined" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/");
  }, [navigate, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleClose, isOpen]);

  const resolveCartTarget = (item) => {
    const cartItemId = Number(item?.cartItemId);
    const productId = Number(item?.productId ?? item?.id ?? item?.product?.id);
    return {
      lineId: item?.lineId,
      cartItemId: Number.isFinite(cartItemId) && cartItemId > 0 ? cartItemId : null,
      productId: Number.isFinite(productId) && productId > 0 ? productId : null,
      variantKey: item?.variantKey ?? null,
    };
  };

  const handleContinueShopping = () => {
    handleClose();
    navigate("/");
  };

  const handleReselectVariant = useCallback(
    (item, invalidItem) => {
      const productId = Number(item?.productId ?? invalidItem?.productId);
      if (!Number.isFinite(productId) || productId <= 0) return;
      if (typeof onClose === "function") {
        onClose();
      }
      navigate(`/product/${encodeURIComponent(String(productId))}`, {
        state: buildVariantRecoveryState(item, invalidItem, "/cart"),
      });
    },
    [navigate, onClose]
  );

  const handleProceedToCheckout = useCallback(() => {
    if (typeof onClose === "function") {
      onClose();
    }
    navigate("/checkout", {
      state: hasCheckoutPreflightInvalidItems
        ? {
            cartPreflightWarning:
              "Some cart lines need attention. Fix the highlighted items before placing the order.",
          }
        : undefined,
    });
  }, [hasCheckoutPreflightInvalidItems, navigate, onClose]);

  const handleReviewIssues = useCallback(() => {
    scrollToFirstCartInvalidItem('[data-cart-drawer-invalid-item="true"]');
  }, []);

  if (!shouldRender) return null;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-0 sm:px-4 sm:py-4 lg:max-w-none lg:px-0 lg:py-0">
      <div
        className={`fixed inset-0 z-50 flex justify-end ${
          isOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        {showBackdrop ? (
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close cart drawer"
            className={`flex-1 bg-slate-900/50 transition-opacity duration-150 ease-out ${
              isOpen ? "opacity-100" : "opacity-0"
            }`}
          />
        ) : null}
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Shopping Cart"
          className={`ml-auto flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.2)] transition-transform duration-200 ease-out sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-[408px] sm:rounded-[22px] sm:border-slate-100 sm:shadow-[0_28px_56px_rgba(15,23,42,0.22)] lg:max-w-[408px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:shadow-[0_0_0_rgba(0,0,0,0)] ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
            <div className="flex items-center gap-2 text-slate-900">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <ShoppingCart className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h1 className="text-[15px] font-semibold sm:text-base">Shopping Cart</h1>
                <p className="text-xs text-slate-500">{items.length} item(s)</p>
              </div>
              {isLoading && hasHydrated ? <UiUpdatingBadge label={UPDATING} /> : null}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3 sm:px-5 sm:py-4">
            {showSkeleton ? (
              <div className="space-y-4">
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : null}

            {isFatalError ? (
              <UiErrorState
                title={GENERIC_ERROR}
                message={errorMessage}
                onRetry={() => refreshCart(false)}
              />
            ) : null}

            {!showSkeleton && !isFatalError && !hasItems ? (
              <div className="flex min-h-full items-center justify-center py-6">
                <UiEmptyState
                  className="w-full max-w-sm rounded-2xl shadow-sm"
                  title="No items added to cart"
                  description="Start shopping and add products to your cart."
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={handleContinueShopping}
                        className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold !text-white visited:!text-white active:!text-white hover:bg-slate-800 hover:no-underline"
                      >
                        Start Shopping
                      </button>
                      <Link
                        to="/"
                        className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:border-slate-400"
                      >
                        Back to Home
                      </Link>
                    </>
                  }
                />
              </div>
            ) : null}

            {!showSkeleton && hasItems ? (
              <div className="space-y-3 pb-3">
                {showInlineError ? (
                  <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {errorMessage}
                    <button
                      type="button"
                      onClick={() => refreshCart(false)}
                      className="ml-2 font-semibold underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </div>
                ) : null}
                {items.map((item) => {
                  const rowTarget = resolveCartTarget(item);
                  const invalidItem = findInvalidVariantCheckoutItem(
                    checkoutPreflightInvalidItems,
                    item
                  );
                  const canReselect = Boolean(rowTarget.productId) && canReselectInvalidCartItem(invalidItem);
                  const quantity = Math.max(1, Number(item.quantity) || 1);
                  const price = Number(item.price) || 0;
                  const stockValue = Number(item.stock);
                  const stock =
                    Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
                  const isDecrementDisabled = isLoading || !rowTarget.productId;
                  const isIncrementDisabled =
                    isLoading ||
                    !rowTarget.productId ||
                    (stock !== null ? quantity >= stock : false);
                  return (
                    <article
                      key={item.lineId ?? rowTarget.productId ?? item.name}
                      data-cart-drawer-invalid-item={invalidItem ? "true" : undefined}
                      className={`rounded-2xl border bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.06)] ${
                        invalidItem
                          ? "border-amber-300 bg-amber-50/70"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 sm:h-[74px] sm:w-[74px]">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-xs text-slate-400">Img</span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900 sm:text-sm">
                            {item.name}
                          </p>
                          {invalidItem ? (
                            <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                              Needs attention
                            </span>
                          ) : null}
                          {getOrderItemVariantLines(item).map((line) => (
                            <p
                              key={`${item.lineId ?? rowTarget.productId ?? item.name}-${line}`}
                              className="mt-1 text-[11px] font-medium text-slate-500"
                            >
                              {line}
                            </p>
                          ))}
                          <p className="mt-1 text-[11px] text-slate-500">
                            Unit {formatCurrency(price)}
                          </p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-900">
                            Total {formatCurrency(price * quantity)}
                          </p>
                        </div>

                        <div className="ml-1 flex shrink-0 flex-col items-end gap-2.5">
                          <button
                            type="button"
                            disabled={isLoading || !rowTarget.productId}
                            onClick={() => {
                              if (!rowTarget.productId) return;
                              remove(rowTarget);
                            }}
                            aria-label={`Remove ${item.name}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <div className="inline-flex h-9 items-center rounded-full border border-emerald-200 bg-emerald-50/30 px-1.5 shadow-sm">
                            <button
                              type="button"
                              disabled={isDecrementDisabled}
                              onClick={() => {
                                if (!rowTarget.productId) return;
                                if (quantity <= 1) {
                                  remove(rowTarget);
                                  return;
                                }
                                update(rowTarget, quantity - 1);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              -
                            </button>
                            <span className="inline-flex min-w-8 items-center justify-center px-1.5 text-sm font-semibold text-slate-900">
                              {quantity}
                            </span>
                            <button
                              type="button"
                              disabled={isIncrementDisabled}
                              onClick={() => {
                                if (!rowTarget.productId) return;
                                const nextQty =
                                  stock !== null ? Math.min(stock, quantity + 1) : quantity + 1;
                                if (nextQty > quantity) {
                                  update(rowTarget, nextQty);
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                      {invalidItem ? (
                        <div className="mt-3 rounded-2xl border border-amber-200 bg-white px-3 py-3 text-xs leading-5 text-amber-800">
                          <p>{invalidItem.message}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isLoading || !rowTarget.productId}
                              onClick={() => {
                                if (!rowTarget.productId) return;
                                remove(rowTarget);
                              }}
                              className="inline-flex h-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Remove item
                            </button>
                            {canReselect ? (
                              <button
                                type="button"
                                disabled={isLoading}
                                onClick={() => handleReselectVariant(item, invalidItem)}
                                className="inline-flex h-9 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Choose variant again
                              </button>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-10px_24px_rgba(15,23,42,0.08)] sm:px-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">Order Summary</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {items.length} Items
                </span>
              </div>
              <div className="mt-3 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(subtotalValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(discountValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="font-medium text-slate-500">{shippingLabel}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-medium text-slate-500">{taxLabel}</span>
                </div>
              </div>
              <div className="mt-3 border-t border-dashed border-slate-200 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">Total</span>
                  <span className="text-lg font-bold text-slate-900">
                    {formatCurrency(totalValue)}
                  </span>
                </div>
              </div>
            </div>
            <div className="mt-3.5 space-y-2.5">
              {hasCheckoutPreflightInvalidItems ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <p>
                    Some items need attention before checkout. Fix the highlighted lines now, or
                    continue to review them in checkout.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleReviewIssues}
                      className="inline-flex h-9 items-center justify-center rounded-full border border-amber-200 bg-white px-4 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                    >
                      Review issues
                    </button>
                  </div>
                </div>
              ) : isCheckoutPreflightLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Checking the latest cart snapshot before checkout.
                </div>
              ) : null}
              {hasItems ? (
                <button
                  type="button"
                  onClick={handleProceedToCheckout}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-[0_10px_18px_rgba(5,150,105,0.3)] transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  Proceed to Checkout
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-300 px-4 text-sm font-semibold text-white"
                >
                  Proceed to Checkout
                </button>
              )}
              {hasItems ? (
                <Link
                  to="/cart"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200"
                >
                  View Cart
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-400"
                >
                  View Cart
                </button>
              )}
            </div>
          </footer>
        </aside>
      </div>
    </div>
  );
}

export default function StoreCartPage() {
  const navigate = useNavigate();
  const {
    items,
    subtotal,
    hasHydrated,
    isLoading,
    error,
    update,
    remove,
    refreshCart,
    hasVariantItems,
  } = useCart();
  const hasItems = items.length > 0;
  const isInitialSyncing = hasHydrated && isLoading && !hasItems;
  const showSkeleton = !hasHydrated || isInitialSyncing;
  const isFatalError = Boolean(error) && !showSkeleton && !hasItems;
  const showInlineError = Boolean(error) && hasItems;
  const lastRefreshAtRef = useRef(0);
  const errorMessage =
    resolveVariantCheckoutMessage(error, "") ||
    error?.response?.data?.message ||
    error?.message ||
    GENERIC_ERROR;
  const hasCheckoutAuthHint = resolveHasCheckoutAuthHint();
  const {
    invalidItems: checkoutPreflightInvalidItems,
    hasInvalidItems: hasCheckoutPreflightInvalidItems,
    isLoading: isCheckoutPreflightLoading,
  } = useCartCheckoutPreflight(
    items,
    hasHydrated && hasItems && !isLoading && hasCheckoutAuthHint
  );
  const subtotalValue = Number(subtotal || 0);
  const discountValue = 0;
  const shippingLabel = "Calculated at checkout";
  const taxLabel = "Calculated at checkout";
  const totalValue = subtotalValue;

  useEffect(() => {
    const now = Date.now();
    const isStale = now - lastRefreshAtRef.current > 30_000;
    if (!hasHydrated || isStale || error) {
      lastRefreshAtRef.current = now;
      void refreshCart(false);
    }
  }, [error, hasHydrated, refreshCart]);

  const resolveCartTarget = (item) => {
    const cartItemId = Number(item?.cartItemId);
    const productId = Number(item?.productId ?? item?.id ?? item?.product?.id);
    return {
      lineId: item?.lineId,
      cartItemId: Number.isFinite(cartItemId) && cartItemId > 0 ? cartItemId : null,
      productId: Number.isFinite(productId) && productId > 0 ? productId : null,
      variantKey: item?.variantKey ?? null,
    };
  };

  const handleReselectVariant = useCallback(
    (item, invalidItem) => {
      const productId = Number(item?.productId ?? invalidItem?.productId);
      if (!Number.isFinite(productId) || productId <= 0) return;
      navigate(`/product/${encodeURIComponent(String(productId))}`, {
        state: buildVariantRecoveryState(item, invalidItem, "/cart"),
      });
    },
    [navigate]
  );

  const handleProceedToCheckout = useCallback(() => {
    navigate("/checkout", {
      state: hasCheckoutPreflightInvalidItems
        ? {
            cartPreflightWarning:
              "Some cart lines need attention. Fix the highlighted items before placing the order.",
          }
        : undefined,
    });
  }, [hasCheckoutPreflightInvalidItems, navigate]);

  const handleReviewIssues = useCallback(() => {
    scrollToFirstCartInvalidItem('[data-cart-page-invalid-item="true"]');
  }, []);

  return (
    <section className="mx-auto max-w-[1240px] space-y-6 px-2 py-2 sm:px-3 lg:px-0">
      <header className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white via-emerald-50/40 to-slate-50 px-4 py-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Cart Overview
            </p>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
              Shopping Cart
            </h1>
            <p className="max-w-2xl text-sm text-slate-500 sm:text-[15px]">
              Review quantities, confirm pricing, and move to checkout when you are ready to
              place the order.
            </p>
          </div>
          <div className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-3.5 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
            {items.length} Active Item{items.length === 1 ? "" : "s"}
          </div>
        </div>
      </header>

      {showSkeleton ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.22fr)_minmax(300px,0.78fr)] lg:gap-7">
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
          </div>
          <div className="h-56 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      ) : null}

      {isFatalError ? (
        <UiErrorState
          title={GENERIC_ERROR}
          message={errorMessage}
          onRetry={() => refreshCart(false)}
        />
      ) : null}

      {!showSkeleton && !isFatalError && !hasItems ? (
        <UiEmptyState
          className="rounded-2xl py-14"
          title="No items added to cart"
          description="Start shopping and add products to your cart."
          actions={
            <>
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Start Shopping
              </Link>
              <Link
                to="/"
                className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-700 hover:border-slate-400"
              >
                Back to Home
              </Link>
            </>
          }
        />
      ) : null}

      {!showSkeleton && !isFatalError && hasItems ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.22fr)_minmax(300px,0.78fr)] lg:items-start lg:gap-7">
          <div className="space-y-4 rounded-[26px] border border-slate-200 bg-white p-3.5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] sm:p-5">
            {showInlineError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {errorMessage}
                <button
                  type="button"
                  onClick={() => refreshCart(false)}
                  className="ml-2 font-semibold underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            ) : null}

            {hasCheckoutPreflightInvalidItems ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p>
                  Some cart lines need attention before checkout. Use the recovery actions below,
                  or continue to checkout to review the same blockers there.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleReviewIssues}
                    className="inline-flex h-9 items-center justify-center rounded-full border border-amber-200 bg-white px-4 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                  >
                    Review issues
                  </button>
                </div>
              </div>
            ) : isCheckoutPreflightLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Checking the latest cart snapshot before checkout.
              </div>
            ) : null}

            {items.map((item) => {
              const rowTarget = resolveCartTarget(item);
              const invalidItem = findInvalidVariantCheckoutItem(
                checkoutPreflightInvalidItems,
                item
              );
              const canReselect = Boolean(rowTarget.productId) && canReselectInvalidCartItem(invalidItem);
              const quantity = Math.max(1, Number(item.quantity) || 1);
              const price = Number(item.price) || 0;
              const stockValue = Number(item.stock);
              const stock =
                Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
              const isDecrementDisabled = isLoading || !rowTarget.productId;
              const isIncrementDisabled =
                isLoading ||
                !rowTarget.productId ||
                (stock !== null ? quantity >= stock : false);
              return (
                <article
                  key={item.lineId ?? rowTarget.productId ?? item.name}
                  data-cart-page-invalid-item={invalidItem ? "true" : undefined}
                  className={`rounded-3xl border bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:p-4 ${
                    invalidItem
                      ? "border-amber-300 bg-amber-50/70"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 sm:h-20 sm:w-20">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs text-slate-400">Img</span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-tight text-slate-900 sm:text-[15px]">
                        {item.name}
                      </p>
                      {invalidItem ? (
                        <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                          Needs attention
                        </span>
                      ) : null}
                      {getOrderItemVariantLines(item).map((line) => (
                        <p
                          key={`${item.lineId ?? rowTarget.productId ?? item.name}-${line}`}
                          className="mt-1 text-xs font-medium text-slate-500"
                        >
                          {line}
                        </p>
                      ))}
                      <p className="mt-1 text-xs text-slate-400">
                        Item Price {formatCurrency(price)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900 sm:text-base">
                        {formatCurrency(price)}
                      </p>
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Total {formatCurrency(price * quantity)}
                      </p>
                    </div>

                    <div className="ml-1 flex shrink-0 flex-col items-end gap-3">
                      <button
                        type="button"
                        disabled={isLoading || !rowTarget.productId}
                        onClick={() => {
                          if (!rowTarget.productId) return;
                          remove(rowTarget);
                        }}
                        aria-label={`Remove ${item.name}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <div className="inline-flex h-9 items-center rounded-full border border-slate-300 bg-white px-1.5 shadow-sm">
                        <button
                          type="button"
                          disabled={isDecrementDisabled}
                          onClick={() => {
                            if (!rowTarget.productId) return;
                            if (quantity <= 1) {
                              remove(rowTarget);
                              return;
                            }
                            update(rowTarget, quantity - 1);
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          -
                        </button>
                        <span className="inline-flex min-w-8 items-center justify-center px-1.5 text-sm font-semibold text-slate-900">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          disabled={isIncrementDisabled}
                          onClick={() => {
                            if (!rowTarget.productId) return;
                            const nextQty =
                              stock !== null ? Math.min(stock, quantity + 1) : quantity + 1;
                            if (nextQty > quantity) {
                              update(rowTarget, nextQty);
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  {invalidItem ? (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm text-amber-900">
                      <p>{invalidItem.message}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={isLoading || !rowTarget.productId}
                          onClick={() => {
                            if (!rowTarget.productId) return;
                            remove(rowTarget);
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Remove item
                        </button>
                        {canReselect ? (
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => handleReselectVariant(item, invalidItem)}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-4 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Choose variant again
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="space-y-3">
                <div className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
                  Ready to Checkout
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                    Order Summary
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {items.length} Items
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-500">
                  Shipping and tax stay flexible here and are confirmed on the checkout step.
                </p>
              </div>
              <div className="mt-5 rounded-[24px] bg-slate-900 px-4 py-4 text-white shadow-[0_18px_34px_rgba(15,23,42,0.18)] sm:px-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Estimated Total
                </p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-3xl font-extrabold leading-none sm:text-[34px]">
                      {formatCurrency(totalValue)}
                    </p>
                    <p className="mt-2 text-xs text-slate-300">
                      Final shipping and tax are shown on the next step.
                    </p>
                  </div>
                  <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
                    Checkout Next
                  </div>
                </div>
              </div>
              <div className="mt-5 space-y-3 border-b border-slate-200 pb-5 text-sm">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(subtotalValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Discount</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(discountValue)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Shipping</span>
                  <span className="font-medium text-slate-500">{shippingLabel}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Tax</span>
                  <span className="font-medium text-slate-500">{taxLabel}</span>
                </div>
              </div>
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {hasCheckoutPreflightInvalidItems
                  ? "Some cart lines need attention before checkout. Fix the highlighted items now, or continue and review them again in checkout."
                  : hasVariantItems
                    ? "Variant selections are preserved through checkout and revalidated against the latest stock before the order is placed."
                    : "Proceed to checkout to confirm shipping, payment method, and the final order total."}
              </div>
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-[0_14px_26px_rgba(5,150,105,0.26)] transition hover:bg-emerald-700"
              >
                Proceed to Checkout
              </button>
              <Link
                to="/"
                className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
              >
                Continue Shopping
              </Link>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
