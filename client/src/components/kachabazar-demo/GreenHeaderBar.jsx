import { Link } from "react-router-dom";

export default function GreenHeaderBar({ search, setSearch, onSubmit, totalQty }) {
  return (
    <div className="bg-emerald-600 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2.5 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-4">
        <Link to="/" className="text-lg font-bold tracking-wide sm:text-xl">
          KACHA BAZAR
        </Link>
        <form
          onSubmit={onSubmit}
          className="order-3 flex h-10 w-full items-center gap-2 rounded-full bg-white px-3 text-slate-700 shadow-sm sm:order-none sm:h-11 sm:flex-1 sm:px-4"
        >
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for products (e.g. shirt, pant)"
            className="w-full bg-transparent text-sm outline-none"
          />
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white sm:h-9 sm:w-9"
          >
            🔍
          </button>
        </form>
        <div className="ml-auto flex items-center gap-2 text-lg sm:gap-3">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 sm:h-10 sm:w-10"
          >
            ♥
          </button>
          <Link
            to="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/20 sm:h-10 sm:w-10"
          >
            🛒
            {totalQty > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[18px] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-semibold text-slate-900">
                {totalQty}
              </span>
            ) : null}
          </Link>
          <Link
            to="/auth/login"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 sm:h-10 sm:w-10"
          >
            👤
          </Link>
        </div>
      </div>
    </div>
  );
}
