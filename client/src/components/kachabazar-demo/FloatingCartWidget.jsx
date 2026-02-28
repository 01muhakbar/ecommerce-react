import { ShoppingCart } from "lucide-react";

export default function FloatingCartWidget({ totalQty, subtotalDisplay }) {
  const handleOpenDrawer = () => {
    window.dispatchEvent(new Event("cart-drawer:open"));
  };

  return (
    <button
      type="button"
      onClick={handleOpenDrawer}
      aria-label="Open shopping cart"
      className="fixed right-4 top-[42%] z-30 hidden w-[92px] -translate-y-1/2 overflow-hidden rounded-[18px] border border-slate-200 bg-white text-slate-900 shadow-[0_20px_45px_rgba(15,23,42,0.16)] transition hover:-translate-y-[calc(50%+2px)] hover:shadow-[0_24px_50px_rgba(15,23,42,0.2)] sm:flex"
    >
      <div className="flex flex-col items-center gap-1.5 px-3 py-3">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <ShoppingCart className="h-4 w-4" />
        </span>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Items</div>
        <div className="text-sm font-bold leading-none text-slate-900">{totalQty}</div>
      </div>
      <div className="w-full bg-emerald-600 px-2 py-2 text-center text-[11px] font-bold text-white">
        {subtotalDisplay}
      </div>
    </button>
  );
}
