import { Link, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "../../hooks/useCart.ts";
import { formatCurrency } from "../../utils/format.js";
import {
  UiEmptyState,
  UiErrorState,
  UiUpdatingBadge,
} from "../../components/ui-states/index.js";
import { GENERIC_ERROR, UPDATING } from "../../constants/uiMessages.js";

export function StoreCartDrawer({
  isOpen = true,
  onClose,
  showBackdrop = true,
}) {
  const navigate = useNavigate();
  const closeButtonRef = useRef(null);
  const { items, subtotal, hasHydrated, isLoading, error, update, remove, refreshCart } =
    useCart();
  const hasItems = items.length > 0;
  const isInitialSyncing = hasHydrated && isLoading && !hasItems;
  const showSkeleton = !hasHydrated || isInitialSyncing;
  const isFatalError = Boolean(error) && !showSkeleton && !hasItems;
  const showInlineError = Boolean(error) && hasItems;
  const [shouldRender, setShouldRender] = useState(isOpen);
  const lastRefreshAtRef = useRef(0);
  const subtotalValue = Number(subtotal || 0);
  const discountValue = 0;
  const shippingLabel = "Calculated at checkout";
  const taxLabel = "Calculated at checkout";
  const totalValue = subtotalValue;
  const errorMessage =
    error?.response?.data?.message ?? error?.message ?? GENERIC_ERROR;

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

  const resolveProductId = (item) => {
    const id = Number(item?.productId ?? item?.id ?? item?.product?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  };

  const handleContinueShopping = () => {
    handleClose();
    navigate("/");
  };

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
          className={`ml-auto flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden rounded-none border border-slate-200 bg-white shadow-sm transition-transform duration-150 ease-out sm:h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-1.5rem)] sm:max-w-[500px] sm:rounded-[24px] sm:shadow-[0_24px_48px_rgba(15,23,42,0.16)] lg:max-w-[430px] lg:rounded-none lg:border-y-0 lg:border-r-0 lg:border-l lg:shadow-none ${
            isOpen ? "translate-x-0" : "translate-x-full"
          }`}
        >
          <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3.5 backdrop-blur sm:px-6">
            <div className="flex items-center gap-2 text-slate-900">
              <ShoppingCart className="h-4 w-4 text-emerald-600" />
              <h1 className="text-base font-semibold sm:text-lg">Shopping Cart</h1>
              {isLoading && hasHydrated ? <UiUpdatingBadge label={UPDATING} /> : null}
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 sm:h-auto sm:w-auto sm:gap-2 sm:px-3 sm:py-1.5"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Close</span>
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 px-4 py-3 sm:px-6 sm:py-4">
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
                  const rowProductId = resolveProductId(item);
                  const quantity = Math.max(1, Number(item.quantity) || 1);
                  const price = Number(item.price) || 0;
                  const stockValue = Number(item.stock);
                  const stock =
                    Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
                  const isDecrementDisabled = isLoading || !rowProductId;
                  const isIncrementDisabled =
                    isLoading ||
                    !rowProductId ||
                    (stock !== null ? quantity >= stock : false);
                  return (
                    <article
                      key={rowProductId ?? item.name}
                      className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
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
                          <p className="text-sm font-semibold leading-tight text-slate-900 line-clamp-2">
                            {item.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Item Price {formatCurrency(price)}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {formatCurrency(price)}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-500">
                            Total {formatCurrency(price * quantity)}
                          </p>
                        </div>

                        <div className="ml-1 flex shrink-0 flex-col items-end gap-3">
                          <button
                            type="button"
                            disabled={isLoading || !rowProductId}
                            onClick={() => {
                              if (!rowProductId) return;
                              remove(rowProductId);
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
                                if (!rowProductId) return;
                                if (quantity <= 1) {
                                  remove(rowProductId);
                                  return;
                                }
                                update(rowProductId, quantity - 1);
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
                                if (!rowProductId) return;
                                const nextQty =
                                  stock !== null ? Math.min(stock, quantity + 1) : quantity + 1;
                                if (nextQty > quantity) {
                                  update(rowProductId, nextQty);
                                }
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 z-10 shrink-0 border-t border-slate-200 bg-white/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3.5 shadow-[0_-6px_18px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-3.5 sm:p-4">
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
              {hasItems ? (
                <Link
                  to="/checkout"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Proceed to Checkout
                </Link>
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
                  className="inline-flex h-10 w-full items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-400"
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
  const { items, subtotal, hasHydrated, isLoading, error, update, remove, refreshCart } =
    useCart();
  const hasItems = items.length > 0;
  const isInitialSyncing = hasHydrated && isLoading && !hasItems;
  const showSkeleton = !hasHydrated || isInitialSyncing;
  const isFatalError = Boolean(error) && !showSkeleton && !hasItems;
  const showInlineError = Boolean(error) && hasItems;
  const lastRefreshAtRef = useRef(0);
  const errorMessage =
    error?.response?.data?.message ?? error?.message ?? GENERIC_ERROR;
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

  const resolveProductId = (item) => {
    const id = Number(item?.productId ?? item?.id ?? item?.product?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  };

  return (
    <section className="mx-auto max-w-[1240px] space-y-6 px-2 py-2 sm:px-3 lg:px-0">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">
          Shopping Cart
        </h1>
        <p className="text-sm text-slate-500">
          Review your items and proceed to checkout when ready.
        </p>
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

            {items.map((item) => {
              const rowProductId = resolveProductId(item);
              const quantity = Math.max(1, Number(item.quantity) || 1);
              const price = Number(item.price) || 0;
              const stockValue = Number(item.stock);
              const stock =
                Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
              const isDecrementDisabled = isLoading || !rowProductId;
              const isIncrementDisabled =
                isLoading ||
                !rowProductId ||
                (stock !== null ? quantity >= stock : false);
              return (
                <article
                  key={rowProductId ?? item.name}
                  className="rounded-3xl border border-slate-200 bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.06)] sm:p-4"
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
                        disabled={isLoading || !rowProductId}
                        onClick={() => {
                          if (!rowProductId) return;
                          remove(rowProductId);
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
                            if (!rowProductId) return;
                            if (quantity <= 1) {
                              remove(rowProductId);
                              return;
                            }
                            update(rowProductId, quantity - 1);
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
                            if (!rowProductId) return;
                            const nextQty =
                              stock !== null ? Math.min(stock, quantity + 1) : quantity + 1;
                            if (nextQty > quantity) {
                              update(rowProductId, nextQty);
                            }
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="lg:sticky lg:top-24">
            <div className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Order Summary</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {items.length} Items
                </span>
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
              <div className="mt-4 flex items-center justify-between border-b border-dashed border-slate-200 pb-4">
                <span className="text-sm font-semibold text-slate-700">Total</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCurrency(totalValue)}
                </span>
              </div>
              <Link
                to="/checkout"
                className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-full bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Proceed to Checkout
              </Link>
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
