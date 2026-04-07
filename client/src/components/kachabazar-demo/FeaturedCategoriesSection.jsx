import { Link } from "react-router-dom";

const STOP_WORDS = new Set([
  "fresh",
  "organic",
  "premium",
  "plain",
  "original",
  "mixed",
  "extra",
  "virgin",
  "for",
  "with",
]);

const tokenize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token &&
        token.length >= 3 &&
        !STOP_WORDS.has(token) &&
        !/^\d+$/.test(token)
    );

const titleize = (word) =>
  word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : "";

const deriveSubLinks = (category, products) => {
  const categoryKey = String(category?.slug || category?.code || "").toLowerCase();
  const pool = (products || []).filter((product) => {
    const productCategory = String(
      product?.category?.slug || product?.category?.code || product?.category?.name || ""
    ).toLowerCase();
    return productCategory.includes(categoryKey) || categoryKey.includes(productCategory);
  });
  if (pool.length === 0) return [];

  const freq = new Map();
  for (const product of pool) {
    for (const token of tokenize(product?.name || product?.title)) {
      freq.set(token, (freq.get(token) || 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([word]) => titleize(word));
};

const renderCategoryVisual = (category) => {
  const rawVisual = String(category?.icon || category?.image || "").trim();
  if (!rawVisual) {
    return (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-sm font-bold text-emerald-600 transition group-hover:bg-emerald-100 group-hover:text-emerald-700">
        {String(category?.name || "C")
          .charAt(0)
          .toUpperCase()}
      </span>
    );
  }
  if (/^(https?:\/\/|\/)/i.test(rawVisual)) {
    return (
      <img
        src={rawVisual}
        alt={String(category?.name || "Category")}
        className="h-10 w-10 rounded-lg border border-slate-100 object-cover"
      />
    );
  }
  return (
    <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-lg transition group-hover:bg-emerald-100">
      {rawVisual}
    </span>
  );
};

function CategoryCell({ category, subLinks }) {
  const slug = String(category?.slug || category?.code || category?.id || "");
  const categoryHref = slug
    ? `/search?category=${encodeURIComponent(slug)}&page=1`
    : "/search?page=1";
  const links = subLinks.length > 0 ? subLinks : ["Featured picks", "Daily deals", "Top items"];

  return (
    <article className="group border-b border-r border-slate-200 bg-white px-4 py-4 transition hover:bg-slate-50/80 sm:px-5">
      <Link to={categoryHref} className="flex items-center gap-3">
        {renderCategoryVisual(category)}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-slate-900 transition group-hover:text-emerald-700">
            {category?.name}
          </h3>
        </div>
      </Link>
      <ul className="mt-3 space-y-1.5">
        {links.map((tag) => (
          <li key={`${slug}-${tag}`}>
            <Link
              to={`/search?category=${encodeURIComponent(slug)}&page=1&q=${encodeURIComponent(tag)}`}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-emerald-600"
            >
              <span className="text-[11px] text-slate-400 transition group-hover:text-emerald-500">
                &gt;
              </span>
              <span className="line-clamp-1">{tag}</span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function FeaturedCategoriesSection({
  title = "Featured Categories",
  description = "Choose your necessary products from this feature categories.",
  maxCategories = 12,
  categories = [],
  products = [],
}) {
  const safeCategories = Array.isArray(categories)
    ? categories.slice(0, Math.max(1, Number(maxCategories) || 12))
    : [];

  return (
    <section className="space-y-6 rounded-3xl bg-slate-100 px-3 py-8 sm:px-5">
      <header className="text-center">
        <h2 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm text-slate-500">
          {description}
        </p>
      </header>

      {safeCategories.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Categories are not available yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border-l border-t border-slate-200 bg-white">
          <div className="grid grid-cols-2 gap-0 md:grid-cols-3 xl:grid-cols-6">
            {safeCategories.map((category) => (
              <CategoryCell
                key={String(category?.id || category?.slug || category?.code)}
                category={category}
                subLinks={deriveSubLinks(category, products)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
