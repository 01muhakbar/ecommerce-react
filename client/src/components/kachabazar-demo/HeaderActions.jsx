import { Bell, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import CartIconButton from "./CartIconButton.jsx";

export default function HeaderActions({ totalQty, isAuthenticated, onCartClick }) {
  const accountHref = isAuthenticated ? "/account" : "/auth/login";
  const accountLabel = isAuthenticated ? "My account" : "Login";

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5">
      <CartIconButton totalQty={totalQty} tone="on-green" onClick={onCartClick} />
      <button
        type="button"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-11 sm:w-11"
        aria-label="Notifications"
        title="Notifications"
      >
        <Bell className="h-[18px] w-[18px]" />
      </button>
      <span className="hidden h-6 w-px bg-white/35 sm:block" aria-hidden />
      <Link
        to={accountHref}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/45 bg-transparent text-white transition hover:bg-white/18 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/45 sm:h-11 sm:w-11"
        aria-label={accountLabel}
        title={accountLabel}
      >
        <UserRound className="h-[18px] w-[18px]" />
      </Link>
    </div>
  );
}
