export default function FloatingCartWidget({ totalQty, subtotalDisplay }) {
  const handleOpenDrawer = () => {
    window.dispatchEvent(new Event("cart-drawer:open"));
  };

  return (
    <button
      type="button"
      onClick={handleOpenDrawer}
      aria-label="Open shopping cart"
      className="fixed right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white text-xs text-slate-900 shadow-xl"
    >
      <div className="flex flex-col items-center gap-1 px-4 py-3">
        <div className="text-lg">🛒</div>
        <div className="text-sm font-semibold">{totalQty} Items</div>
      </div>
      <div className="w-full bg-emerald-600 px-4 py-2 text-center text-[11px] font-semibold text-white">
        {subtotalDisplay}
      </div>
    </button>
  );
}
