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
      ? "border-white/40 bg-white/10 text-white hover:bg-white/20"
      : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600";
  const className = `relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-1 sm:h-11 sm:w-11 ${baseClass}`;
  const badge = (
    <span
      className={`absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border border-white px-1 text-[10px] font-extrabold leading-none shadow-[0_3px_10px_rgba(15,23,42,0.28)] sm:h-[19px] sm:min-w-[19px] sm:text-[10px] ${
        safeQty > 0
          ? "bg-emerald-500 text-white"
          : "pointer-events-none scale-75 opacity-0"
      }`}
      aria-hidden={safeQty === 0}
    >
      {safeQty > 99 ? "99+" : safeQty}
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
