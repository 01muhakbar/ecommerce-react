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
    `transition ${
      isActive ? "font-semibold text-emerald-700 underline decoration-2 underline-offset-4" : "hover:text-emerald-600"
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
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-4 py-3 text-sm">
        <div className="relative" data-demo-dropdown>
          <button
            type="button"
            onClick={() => setShowCategories((prev) => !prev)}
            className="flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2"
          >
            Categories <span className="text-xs">▾</span>
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

        <div className="flex flex-wrap items-center gap-8">
          <NavLink to="/about-us" className={navItemClass}>
            About Us
          </NavLink>
          <NavLink to="/contact-us" className={navItemClass}>
            Contact Us
          </NavLink>
          <NavLink
            to="/offers"
            className={({ isActive }) =>
              `relative inline-flex items-center gap-2 transition ${
                isActive
                  ? "font-semibold text-emerald-700 underline decoration-2 underline-offset-4"
                  : "hover:text-emerald-600"
              }`
            }
          >
            Offers
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </NavLink>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          <span>English</span>
          <Link to="/privacy" className="hover:text-emerald-600">
            Privacy Policy
          </Link>
          <Link to="/terms" className="hover:text-emerald-600">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </div>
  );
}
