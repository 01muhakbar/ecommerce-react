import { Link } from "react-router-dom";
import { useCartStore } from "../../store/cart.store.ts";

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
});

export default function StoreCartPage() {
  const items = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const updateQty = useCartStore((state) => state.updateQty);
  const removeItem = useCartStore((state) => state.removeItem);

  if (items.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-center">
        <h1 className="text-xl font-semibold">Your cart is empty</h1>
        <p className="mt-2 text-sm text-slate-500">
          Add items from the catalog to get started.
        </p>
        <Link
          to="/search"
          className="mt-6 inline-flex rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Browse products
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold">Your cart</h1>
      <div className="grid gap-4">
        {items.map((item) => (
          <div
            key={item.productId}
            className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-slate-100 text-xs text-slate-400">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                "No image"
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">{item.name}</div>
              <div className="text-xs text-slate-500">
                {currency.format(Number(item.price || 0))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateQty(item.productId, item.qty - 1)}
                className="h-8 w-8 rounded-full border border-slate-200"
              >
                -
              </button>
              <span className="text-sm font-semibold">{item.qty}</span>
              <button
                type="button"
                onClick={() => updateQty(item.productId, item.qty + 1)}
                className="h-8 w-8 rounded-full border border-slate-200"
              >
                +
              </button>
            </div>
            <div className="text-sm font-semibold text-slate-900">
              {currency.format(Number(item.price || 0) * item.qty)}
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.productId)}
              className="text-xs text-rose-500 hover:text-rose-600"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:flex-row md:items-center">
        <div className="text-sm text-slate-500">Subtotal</div>
        <div className="text-xl font-semibold text-slate-900">
          {currency.format(Number(subtotal || 0))}
        </div>
        <Link
          to="/checkout"
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white"
        >
          Proceed to Checkout
        </Link>
      </div>
    </section>
  );
}
