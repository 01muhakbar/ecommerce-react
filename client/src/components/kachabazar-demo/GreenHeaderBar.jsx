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
    <div className="bg-emerald-600 text-white shadow-[0_2px_12px_rgba(5,150,105,0.28)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2.5 md:px-6 lg:flex-nowrap lg:gap-6 lg:py-3.5">
        <Link
          to="/"
          className="inline-flex h-10 shrink-0 items-center gap-2 text-sm font-extrabold tracking-[0.13em] text-white sm:h-11 sm:text-[15px]"
          aria-label="Go to homepage"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/35 bg-white/10">
            <Lock className="h-[15px] w-[15px]" />
          </span>
          KACHA BAZAR
        </Link>
        <div className="order-3 basis-full lg:order-none lg:flex-1 lg:px-4">
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
