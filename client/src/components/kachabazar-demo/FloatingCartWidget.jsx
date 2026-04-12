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
      className="no-print fixed right-3 top-1/2 z-30 hidden w-[98px] -translate-y-1/2 flex-col items-center rounded-[18px] border border-slate-200 bg-white px-2.5 pb-3.5 pt-3.5 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.15)] transition hover:-translate-y-[calc(50%+2px)] hover:shadow-[0_22px_46px_rgba(15,23,42,0.18)] sm:flex"
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 text-emerald-600">
        <ShoppingCart className="h-4.5 w-4.5" />
      </span>
      <div className="mt-3 text-[11px] font-semibold leading-none text-slate-500">
        {totalQty} Items
      </div>
      <div className="mt-3 w-[118px] rounded-[13px] bg-emerald-500 px-3 py-2 text-center text-[15px] font-bold leading-none text-white shadow-[0_10px_20px_rgba(5,150,105,0.24)]">
        {subtotalDisplay}
      </div>
    </button>
  );
}
