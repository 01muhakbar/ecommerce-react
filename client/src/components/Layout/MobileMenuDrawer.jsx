import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  X,
} from "lucide-react";
import { useStoreCategories } from "../../hooks/useStoreCategories.ts";
import CategoryAccordion from "../store/CategoryAccordion.jsx";
import { buildCategoryTree } from "../../utils/categoryTree.ts";

const PAGE_LINKS = [
  { label: "Home", to: "/" },
  { label: "Offers", to: "/offers" },
  { label: "About Us", to: "/about-us" },
  { label: "Contact Us", to: "/contact-us" },
  { label: "My Account", to: "/user/my-account" },
];

export default function MobileMenuDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const { data: categories, isLoading: categoriesLoading } = useStoreCategories();
  const [activeTab, setActiveTab] = useState("category");
  const categoryTree = useMemo(() => buildCategoryTree(categories || []), [categories]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab("category");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscClose = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscClose);
    return () => window.removeEventListener("keydown", handleEscClose);
  }, [isOpen, onClose]);

  const handleSelectCategory = (node) => {
    const categoryKey = String(node?.code || node?.slug || node?.id || "").trim();
    if (!categoryKey) return;
    onClose();
    navigate(`/search?category=${encodeURIComponent(categoryKey)}`);
  };

  return (
    <div
      className={`fixed inset-0 z-50 sm:hidden ${
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      }`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        aria-label="Close menu"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <aside
        className={`absolute left-0 top-0 h-full w-[85%] max-w-[320px] transform bg-white shadow-xl transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex h-full flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close drawer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-sm font-extrabold tracking-wide text-slate-900">
              KACHA BAZAR
            </div>
          </div>

          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setActiveTab("category")}
              className={`h-11 border-b-2 text-sm font-medium ${
                activeTab === "category"
                  ? "border-indigo-600 font-semibold text-indigo-600"
                  : "border-transparent text-slate-500"
              }`}
            >
              Category
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("pages")}
              className={`h-11 border-b-2 text-sm font-medium ${
                activeTab === "pages"
                  ? "border-indigo-600 font-semibold text-indigo-600"
                  : "border-transparent text-slate-500"
              }`}
            >
              Pages
            </button>
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {activeTab === "category" ? (
              categoriesLoading ? (
                <div className="space-y-2 px-4 py-4">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div
                      key={`drawer-categories-loading-${index}`}
                      className="h-11 animate-pulse rounded-lg bg-slate-100"
                    />
                  ))}
                </div>
              ) : categories.length > 0 ? (
                <div className="px-2 py-1">
                  <CategoryAccordion
                    nodes={categoryTree}
                    onSelect={handleSelectCategory}
                    defaultExpandedIds={categoryTree.slice(0, 1).map((item) => item.id)}
                  />
                </div>
              ) : (
                <div className="px-4 py-6 text-sm text-slate-500">No categories found.</div>
              )
            ) : (
              PAGE_LINKS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className="flex min-h-12 items-center justify-between border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
