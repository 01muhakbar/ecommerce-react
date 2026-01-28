import { Link } from "react-router-dom";

export default function FeaturedCategoriesMega({ featuredCategories }) {
  return (
    <section className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Featured Categories</h2>
        <p className="mt-2 text-sm text-slate-500">Choose your product category</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {featuredCategories.map((category, index) => (
          <Link
            key={category.id || index}
            to={`/category/${encodeURIComponent(category.slug)}`}
            className="flex h-full items-start gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl">
              {category.icon || "🥬"}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">{category.name}</div>
              <div className="mt-3 space-y-1 text-xs text-slate-500">
                {(category.items || ["Item one", "Item two", "Item three"]).slice(0, 3).map((item, idx) => (
                  <div key={idx}>› {item}</div>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
