import { ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";

export default function CartIconButton({
  to = "/",
  totalQty = 0,
  tone = "default",
  onClick,
}) {
  const safeQty = Number(totalQty) > 0 ? Number(totalQty) : 0;
  const baseClass =
    tone === "on-green"
      ? "border-white/35 bg-white/10 text-white hover:bg-white/20"
      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600";
  const className = `relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 sm:h-11 sm:w-11 ${baseClass}`;
  const badge = (
    <span
      className={`absolute right-0 top-0 inline-flex h-[17px] min-w-[17px] translate-x-[25%] -translate-y-[20%] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none ${
        safeQty > 0 ? "bg-rose-500 text-white" : "pointer-events-none opacity-0"
      }`}
      aria-hidden={safeQty === 0}
    >
      {safeQty}
    </span>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={className}
        aria-label="View cart"
      >
        <ShoppingCart className="h-[18px] w-[18px]" />
        {badge}
      </button>
    );
  }

  return (
    <Link
      to={to}
      className={className}
      aria-label="View cart"
    >
      <ShoppingCart className="h-[18px] w-[18px]" />
      {badge}
    </Link>
  );
}
