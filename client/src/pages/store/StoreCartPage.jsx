import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useCart } from "../../hooks/useCart.ts";
import { formatCurrency } from "../../utils/format.js";

export default function StoreCartPage() {
  const { items, subtotal, hasHydrated, isLoading, error, update, remove, refreshCart } =
    useCart();
  const hasItems = items.length > 0;

  useEffect(() => {
    refreshCart();
  }, [refreshCart]);

  if (!hasHydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Loading cart...
          </h1>
          <p className="mt-2 text-sm text-slate-500">Please wait.</p>
        </div>
      </div>
    );
  }

  if (!hasItems) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Cart kamu masih kosong
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Yuk mulai belanja produk favoritmu.
          </p>
          <Link
            to="/search"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold !text-white visited:!text-white active:!text-white hover:bg-slate-800 hover:no-underline"
          >
            Shop now
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Your cart</h1>
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
          {items.map((item) => (
            <div
              key={item.productId}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-slate-100">
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
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-900 line-clamp-2">
                    {item.name}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {formatCurrency(Number(item.price || 0))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => update(item.productId, item.quantity - 1)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm hover:border-slate-300"
                  >
                    -
                  </button>
                  <span className="text-sm font-semibold">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => update(item.productId, item.quantity + 1)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-sm hover:border-slate-300"
                  >
                    +
                  </button>
                </div>
                <div className="text-sm font-semibold text-slate-900 md:min-w-[96px] md:text-right">
                  {formatCurrency(Number(item.price || 0) * item.quantity)}
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.productId)}
                  className="text-sm font-semibold text-rose-600 hover:text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-1">
          {hasItems ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-24">
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
                  <span className="text-slate-500">Calculated at checkout</span>
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
                  className="inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <span className="text-white">Proceed to checkout</span>
                </Link>
                <Link
                  to="/search"
                  className="block w-full rounded-full border border-slate-200 px-6 py-3 text-center text-sm font-semibold text-slate-700 hover:border-slate-300"
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
