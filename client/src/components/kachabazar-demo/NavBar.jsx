import { useMemo } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import CategoryAccordion from "../store/CategoryAccordion.jsx";
import { buildCategoryTree } from "../../utils/categoryTree.ts";

export default function NavBar({
  showCategories,
  setShowCategories,
  showPages,
  setShowPages,
  categories,
  categoriesLoading,
}) {
  const navigate = useNavigate();
  const navItemClass = ({ isActive }) =>
    `text-[14px] font-medium text-slate-700 transition ${
      isActive
        ? "text-emerald-700 underline decoration-2 underline-offset-4"
        : "hover:text-emerald-600 hover:underline hover:decoration-1 hover:underline-offset-4"
    }`;
  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories]);

  const handleSelectCategory = (node) => {
    const categoryKey = String(node?.code || node?.slug || node?.id || "").trim();
    if (!categoryKey) return;
    setShowCategories(false);
    navigate(`/search?category=${encodeURIComponent(categoryKey)}`);
  };

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-5 lg:gap-7">
          <div className="relative" data-demo-dropdown>
            <button
              type="button"
              onClick={() => setShowCategories((prev) => !prev)}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 px-4 text-[14px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Categories <span className="text-[10px] text-slate-500">▾</span>
            </button>
            {showCategories ? (
              <div className="absolute left-0 top-12 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
                {categoriesLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={`categories-loading-${index}`}
                      className="mb-1 h-9 animate-pulse rounded-lg bg-slate-100 last:mb-0"
                    />
                  ))
                ) : categories.length === 0 ? (
                  <div className="rounded-lg px-3 py-2 text-xs text-slate-500">No categories</div>
                ) : (
                  <CategoryAccordion
                    nodes={categoryTree}
                    onSelect={handleSelectCategory}
                    defaultExpandedIds={categoryTree.slice(0, 1).map((item) => item.id)}
                  />
                )}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-6 lg:gap-7">
            <NavLink to="/about-us" className={navItemClass}>
              About Us
            </NavLink>
            <NavLink to="/contact-us" className={navItemClass}>
              Contact Us
            </NavLink>
            <div className="relative" data-demo-dropdown>
              <button
                type="button"
                onClick={() => setShowPages((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-[14px] font-medium text-slate-700 transition hover:text-emerald-600 hover:underline hover:decoration-1 hover:underline-offset-4"
              >
                Pages <span className="text-[10px] text-slate-500">▾</span>
              </button>
              {showPages ? (
                <div className="absolute left-0 top-9 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 text-sm shadow-lg">
                  <Link to="/about-us" className="block rounded-lg px-3 py-2 hover:bg-slate-50">
                    About Us
                  </Link>
                  <Link to="/contact-us" className="block rounded-lg px-3 py-2 hover:bg-slate-50">
                    Contact Us
                  </Link>
                  <Link to="/offers" className="block rounded-lg px-3 py-2 hover:bg-slate-50">
                    Offers
                  </Link>
                  <Link to="/account" className="block rounded-lg px-3 py-2 hover:bg-slate-50">
                    My Account
                  </Link>
                </div>
              ) : null}
            </div>
            <NavLink
              to="/offers"
              className={({ isActive }) =>
                `relative inline-flex items-center pr-2 text-[14px] font-medium transition ${
                  isActive
                    ? "font-semibold text-emerald-700 underline decoration-2 underline-offset-4"
                    : "text-slate-700 hover:text-emerald-600 hover:underline hover:decoration-1 hover:underline-offset-4"
                }`
              }
            >
              Offers
              <span className="absolute -right-0.5 top-0 h-1.5 w-1.5 rounded-full bg-rose-500" />
            </NavLink>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px] text-slate-500">
          <span>English</span>
          <Link to="/privacy" className="transition hover:text-emerald-600">
            Privacy Policy
          </Link>
          <Link to="/terms" className="transition hover:text-emerald-600">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
