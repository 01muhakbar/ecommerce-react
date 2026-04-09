import { useMemo } from "react";
import { Link } from "react-router-dom";

const toText = (value) => String(value ?? "").trim();

const buildCategoryHref = (value) => {
  const slug = toText(value);
  return slug ? `/search?category=${encodeURIComponent(slug)}&page=1` : "/search?page=1";
};

const buildSubLinksByParent = (allCategories = []) => {
  const map = new Map();

  allCategories.forEach((category, index) => {
    const parentId = category?.parentId ?? category?.parent_id ?? null;
    if (parentId === null || parentId === undefined || toText(parentId) === "") return;

    const label = toText(category?.name || category?.title || category?.label);
    if (!label) return;

    const slug =
      toText(category?.slug || category?.code || category?.id) ||
      `category-${index + 1}`;
    const parentKey = toText(parentId);
    const next = map.get(parentKey) || [];

    if (next.some((item) => item.slug === slug || item.label.toLowerCase() === label.toLowerCase())) {
      return;
    }

    next.push({
      slug,
      label,
      href: buildCategoryHref(slug),
    });
    map.set(parentKey, next);
  });

  return map;
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
  const categoryHref = buildCategoryHref(slug);
  const links =
    subLinks.length > 0 ? subLinks : [{ label: "Browse category", href: categoryHref, slug }];

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
        {links.map((link) => (
          <li key={`${slug}-${link.slug || link.href || link.label}`}>
            <Link
              to={link.href || categoryHref}
              className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-emerald-600"
            >
              <span className="text-[11px] text-slate-400 transition group-hover:text-emerald-500">
                &gt;
              </span>
              <span className="line-clamp-1">{link.label}</span>
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
  allCategories = [],
}) {
  const safeCategories = Array.isArray(categories)
    ? categories.slice(0, Math.max(1, Number(maxCategories) || 12))
    : [];
  const subLinksByParent = useMemo(
    () => buildSubLinksByParent(Array.isArray(allCategories) ? allCategories : []),
    [allCategories]
  );

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
                subLinks={subLinksByParent.get(toText(category?.id))?.slice(0, 3) || []}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
