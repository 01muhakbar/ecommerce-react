import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ProductCardKacha from "./ProductCardKacha.jsx";

const normalizeValue = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function ProductSkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3 sm:p-3.5">
      <div className="aspect-square rounded-xl bg-slate-200" />
      <div className="mt-3 h-4 w-4/5 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-1/3 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-1/2 rounded bg-slate-200" />
    </div>
  );
}

const buildTabFromCategory = (category) => {
  const id = String(category?.id ?? "").trim();
  const slug = String(category?.slug || category?.code || "").trim();
  const code = String(category?.code || "").trim();
  const name = String(category?.name || "Category").trim();
  const key = slug || code || id || normalizeValue(name);

  return {
    key,
    id,
    slug,
    code,
    label: name || "Category",
    slugNorm: normalizeValue(slug),
    codeNorm: normalizeValue(code),
    nameNorm: normalizeValue(name),
  };
};

const matchesCategoryTab = (product, tab) => {
  if (!tab || tab.key === "all") return true;

  const productCategoryId = String(
    product?.categoryId ?? product?.category?.id ?? ""
  ).trim();
  const productCategorySlug = normalizeValue(
    product?.categorySlug || product?.category?.slug || product?.category?.code
  );
  const productCategoryCode = normalizeValue(
    product?.categoryCode || product?.category?.code
  );
  const productCategoryName = normalizeValue(
    product?.categoryName || product?.category?.name
  );

  if (tab.id && productCategoryId && tab.id === productCategoryId) return true;

  const exactKeys = [productCategorySlug, productCategoryCode, productCategoryName].filter(Boolean);
  if (tab.slugNorm && exactKeys.includes(tab.slugNorm)) return true;
  if (tab.codeNorm && exactKeys.includes(tab.codeNorm)) return true;
  if (tab.nameNorm && exactKeys.includes(tab.nameNorm)) return true;

  if (
    tab.nameNorm &&
    exactKeys.some(
      (value) => value.includes(tab.nameNorm) || tab.nameNorm.includes(value)
    )
  ) {
    return true;
  }

  return false;
};

export default function ProductSection({
  title = "Popular Products for Daily Shopping",
  subtitle = "See all products we have prepared for your cart today.",
  maxProducts = 18,
  products = [],
  categories = [],
  isLoading = false,
  isError = false,
  onRetry,
}) {
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState("default");

  const tabs = useMemo(() => {
    const source =
      Array.isArray(categories) && categories.length > 0
        ? categories
        : Array.isArray(products)
        ? products
            .map((product) => product?.category)
            .filter(Boolean)
        : [];

    const seen = new Set();
    const categoryTabs = [];
    for (const item of source) {
      const tab = buildTabFromCategory(item);
      if (!tab.key || seen.has(tab.key)) continue;
      seen.add(tab.key);
      categoryTabs.push(tab);
      if (categoryTabs.length >= 5) break;
    }

    return [{ key: "all", label: "All" }, ...categoryTabs];
  }, [categories, products]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("all");
    }
  }, [tabs, activeTab]);

  const activeTabMeta = useMemo(
    () => tabs.find((tab) => tab.key === activeTab) || tabs[0] || { key: "all", label: "All" },
    [tabs, activeTab]
  );

  const displayProducts = useMemo(() => {
    const byTab = (Array.isArray(products) ? products : []).filter((product) =>
      matchesCategoryTab(product, activeTabMeta)
    );

    const sorted = [...byTab];
    if (sortBy === "price_asc") {
      sorted.sort((a, b) => Number(a?.price || 0) - Number(b?.price || 0));
    } else if (sortBy === "price_desc") {
      sorted.sort((a, b) => Number(b?.price || 0) - Number(a?.price || 0));
    } else if (sortBy === "name_asc") {
      sorted.sort((a, b) =>
        String(a?.name || a?.title || "").localeCompare(String(b?.name || b?.title || ""))
      );
    }
    return sorted.slice(0, Math.max(1, Number(maxProducts) || 18));
  }, [products, activeTabMeta, sortBy, maxProducts]);

  const viewAllLink = useMemo(() => {
    if (activeTabMeta?.key === "all") return "/search?page=1";
    if (activeTabMeta?.slug) {
      return `/search?category=${encodeURIComponent(activeTabMeta.slug)}&page=1`;
    }
    if (activeTabMeta?.label) {
      return `/search?category=${encodeURIComponent(activeTabMeta.label)}&page=1`;
    }
    return "/search?page=1";
  }, [activeTabMeta]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold leading-tight text-slate-900 sm:text-[28px]">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 focus:border-slate-300 focus:outline-none"
          >
            <option value="default">Sort: Default</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="name_asc">Name: A-Z</option>
          </select>
          <Link
            to={viewAllLink}
            className="inline-flex h-9 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
          >
            View All
          </Link>
        </div>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex h-9 shrink-0 items-center rounded-full px-4 text-xs font-semibold transition ${
                active
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductSkeletonCard key={`product-skeleton-${index}`} />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-600">
          <div>Failed to load products.</div>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 inline-flex rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : displayProducts.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No products found for this selection.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {displayProducts.map((product, index) => (
            <ProductCardKacha
              key={`${product?.id ?? product?.slug ?? "product"}-${index}`}
              product={product}
            />
          ))}
        </div>
      )}
    </section>
  );
}
