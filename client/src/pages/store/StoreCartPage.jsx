import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Trash2 } from "lucide-react";
import { useCart } from "../../hooks/useCart.ts";
import { formatCurrency } from "../../utils/format.js";

export default function StoreCartPage() {
  const { items, subtotal, hasHydrated, isLoading, error, update, remove, refreshCart } =
    useCart();
  const hasItems = items.length > 0;
  const isInitialSyncing = hasHydrated && isLoading && !hasItems;

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:py-10 sm:pb-10">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="h-5 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (isInitialSyncing) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:py-10 sm:pb-10">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
          <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:py-10 sm:pb-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center sm:p-10">
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Cart kamu masih kosong
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Yuk mulai belanja produk favoritmu.
          </p>
          <Link
            to="/search"
            className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold !text-white visited:!text-white active:!text-white hover:bg-slate-800 hover:no-underline sm:w-auto"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:py-10 sm:pb-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Your cart</h1>
        <p className="mt-1 text-sm text-slate-500">
          Review items and proceed to checkout.
        </p>
        {isLoading ? (
          <p className="mt-2 text-xs text-slate-400">Syncing cart...</p>
        ) : null}
        {error ? (
          <p className="mt-2 text-xs text-rose-600">
            Failed to sync cart. Please try again.
          </p>
        ) : null}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {items.map((item) => {
            const quantity = Math.max(1, Number(item.quantity) || 1);
            const price = Number(item.price) || 0;
            const lineTotal = price * quantity;
            const stockValue = Number(item.stock);
            const stock =
              Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : null;
            const isDecrementDisabled = isLoading || quantity <= 1;
            const isIncrementDisabled =
              isLoading || (stock !== null ? quantity >= stock : false);
            return (
              <div
                key={item.productId}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-20 sm:w-20">
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                        Img
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                      {item.name}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Item price {formatCurrency(price)}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1">
                        <button
                          type="button"
                          disabled={isDecrementDisabled}
                          onClick={() => update(item.productId, Math.max(1, quantity - 1))}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          -
                        </button>
                        <span className="inline-flex min-w-10 items-center justify-center px-2 text-sm font-semibold text-slate-900">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          disabled={isIncrementDisabled}
                          onClick={() => {
                            const nextQty =
                              stock !== null ? Math.min(stock, quantity + 1) : quantity + 1;
                            if (nextQty > quantity) {
                              update(item.productId, nextQty);
                            }
                          }}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] uppercase tracking-wide text-slate-400">Total</div>
                        <div className="text-sm font-semibold text-slate-900">
                          {formatCurrency(Number.isFinite(lineTotal) ? lineTotal : 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.productId)}
                    aria-label={`Remove ${item.name}`}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-rose-100 text-rose-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          {hasItems ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:sticky lg:top-24">
              <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(Number(subtotal || 0))}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span className="font-medium text-slate-500">{formatCurrency(0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Discount</span>
                  <span className="font-medium text-slate-500">-{formatCurrency(0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-semibold text-slate-900">
                    {formatCurrency(Number(subtotal || 0))}
                  </span>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                <Link
                  to="/checkout"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <span className="text-white">Proceed to checkout</span>
                </Link>
                <Link
                  to="/search"
                  className="inline-flex h-12 w-full items-center justify-center rounded-full border border-slate-200 px-6 text-center text-sm font-semibold text-slate-700 hover:border-slate-300"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
