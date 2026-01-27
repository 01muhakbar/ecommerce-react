import { Link, Outlet, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useCartStore } from "../../store/cart.store.ts";
import { CategoryDropdown, useCategories } from "../../storefront.jsx";
import "./StoreLayout.css";

export default function StoreLayout() {
  const totalQty = useCartStore((state) => state.totalQty);
  const { data, isLoading } = useCategories();
  const categories = data?.data?.items ?? [];
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    setQuery(searchParams.get("q") ?? "");
    setCategory(searchParams.get("category") ?? "");
  }, [searchParams]);

  const totalQtyBadge = useMemo(() => (totalQty > 0 ? totalQty : null), [totalQty]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (category) {
      params.set("category", category);
    }
    params.set("page", "1");
    navigate(`/search?${params.toString()}`);
  };

  const handleCategoryChange = (nextCategory) => {
    setCategory(nextCategory);
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set("q", query.trim());
    }
    if (nextCategory) {
      params.set("category", nextCategory);
    }
    params.set("page", "1");
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-4">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            KachaBazaar
          </Link>
          <div className="hidden md:flex">
            <CategoryDropdown
              categories={categories}
              value={category}
              onChange={handleCategoryChange}
              isLoading={isLoading}
            />
          </div>
          <form onSubmit={handleSubmit} className="flex flex-1 items-center gap-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search products"
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Search
            </button>
          </form>
          <nav className="flex items-center gap-3 text-sm">
            <Link to="/" className="text-slate-600 hover:text-slate-900">
              Home
            </Link>
            <Link to="/cart" className="relative text-slate-600 hover:text-slate-900">
              Cart
              {totalQtyBadge ? (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-400 px-1 text-[11px] font-semibold text-slate-900">
                  {totalQtyBadge}
                </span>
              ) : null}
            </Link>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 pb-4 md:hidden">
          <CategoryDropdown
            categories={categories}
            value={category}
            onChange={handleCategoryChange}
            isLoading={isLoading}
            mobileOnly
          />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-slate-500">
          Crafted for local storefront demos.
        </div>
      </footer>
    </div>
  );
}