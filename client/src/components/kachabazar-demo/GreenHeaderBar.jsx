import { Link } from "react-router-dom";

export default function GreenHeaderBar({ search, setSearch, onSubmit, totalQty }) {
  return (
    <div className="bg-emerald-600 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-4">
        <Link to="/" className="text-xl font-bold tracking-wide">
          KACHA BAZAR
        </Link>
        <form
          onSubmit={onSubmit}
          className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2 text-slate-700 shadow-sm"
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
            className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white"
          >
            🔍
          </button>
        </form>
        <div className="flex items-center gap-3 text-lg">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            ♥
          </button>
          <Link
            to="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
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
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
          >
            👤
          </Link>
        </div>
      </div>
    </div>
  );
}
