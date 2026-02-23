import { Link } from "react-router-dom";

export default function FeatureStrip() {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-[#f1d2b3] bg-[#FDEEDC] px-5 py-6 shadow-sm sm:px-7 sm:py-7">
      <div className="pointer-events-none absolute -right-8 top-0 h-24 w-24 rounded-full bg-orange-200/45 blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 right-16 h-16 w-16 rounded-full bg-amber-200/45 blur-2xl" />
      <div className="relative flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold leading-tight text-slate-900 sm:text-2xl">
            100% Natural Quality Organic Product
          </h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Fresh daily essentials and healthy groceries selected for your family.
          </p>
        </div>
        <Link
          to="/search?q=organic&page=1"
          className="inline-flex shrink-0 items-center rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 sm:px-5 sm:text-sm"
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}
