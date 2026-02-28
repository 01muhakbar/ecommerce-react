import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import HeaderSearch from "./HeaderSearch.jsx";
import HeaderActions from "./HeaderActions.jsx";

export default function GreenHeaderBar({
  search,
  setSearch,
  onSubmit,
  totalQty,
  isAuthenticated,
  onCartClick,
}) {
  return (
    <div className="bg-emerald-600 text-white shadow-[0_2px_10px_rgba(5,150,105,0.22)]">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-5 lg:flex-nowrap lg:gap-5 lg:px-6 lg:py-3">
        <Link
          to="/"
          className="inline-flex h-10 shrink-0 items-center gap-2.5 text-sm font-extrabold tracking-[0.11em] text-white sm:h-11 sm:text-[15px]"
          aria-label="Go to homepage"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/35 bg-white/10 sm:h-8 sm:w-8">
            <Lock className="h-[15px] w-[15px] sm:h-4 sm:w-4" />
          </span>
          <span className="leading-none">KACHA BAZAR</span>
        </Link>
        <div className="order-3 basis-full pt-0.5 sm:pt-1 lg:order-none lg:flex-1 lg:pt-0">
          <HeaderSearch
            search={search}
            setSearch={setSearch}
            onSubmit={onSubmit}
            variant="desktop"
            placeholder="Search for products (e.g. fish, apple, baby care)"
          />
        </div>
        <HeaderActions
          totalQty={totalQty}
          isAuthenticated={isAuthenticated}
          onCartClick={onCartClick}
        />
      </div>
    </div>
  );
}
