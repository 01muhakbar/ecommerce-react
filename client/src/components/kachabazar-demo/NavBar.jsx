import { Link } from "react-router-dom";

export default function NavBar({
  showCategories,
  setShowCategories,
  showPages,
  setShowPages,
  dummyCategories,
}) {
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
            <div className="absolute left-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 text-sm shadow-lg">
              {dummyCategories.slice(0, 6).map((item, index) => {
                const baseKey =
                  item.id ??
                  item._id ??
                  item.slug ??
                  item.href ??
                  item.path ??
                  item.code ??
                  item.name;
                const safeKey = String(baseKey ?? "").trim() || `category-${index}`;
                const hrefSlug = item.slug ?? item.code ?? "";
                return (
                  <Link
                    key={safeKey}
                    to={`/category/${encodeURIComponent(hrefSlug)}`}
                    className="block rounded-lg px-3 py-2 text-slate-900 hover:bg-slate-100"
                  >
                    {item.name ??
                      item.title ??
                      item.label ??
                      item.categoryName ??
                      item.code ??
                      item.slug ??
                      "Category"}
                  </Link>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-8">
          <Link to="/about" className="hover:text-emerald-600">
            About Us
          </Link>
          <Link to="/contact" className="hover:text-emerald-600">
            Contact Us
          </Link>
          <Link to="/offers" className="relative inline-flex items-center gap-2">
            Offers
            <span className="h-2 w-2 rounded-full bg-rose-500" />
          </Link>
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
