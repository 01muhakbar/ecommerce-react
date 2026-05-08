import { Search, X } from "lucide-react";

export default function HeaderSearch({
  search,
  setSearch,
  onSubmit,
  className = "",
  variant = "default",
  placeholder = "Search for products (e.g. fish, apple, baby care)",
}) {
  const isDesktop = variant === "desktop";

  return (
    <form
      onSubmit={onSubmit}
      className={`relative w-full overflow-hidden rounded-full transition focus-within:ring-2 focus-within:ring-emerald-200/80 ${
        isDesktop
          ? "h-[44px] border border-emerald-100/90 bg-white shadow-[0_6px_16px_rgba(15,23,42,0.15)] lg:h-12"
          : "h-11 border border-white/25 bg-slate-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)] sm:h-12"
      } ${className}`}
      role="search"
      aria-label="Store search"
    >
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && search) {
            setSearch("");
          }
        }}
        placeholder={placeholder}
        className="h-full w-full rounded-full bg-transparent pl-4 pr-16 text-[13px] text-slate-700 outline-none placeholder:font-medium placeholder:text-slate-400 sm:pl-5 sm:text-sm"
      />
      {search ? (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="absolute right-11 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200/80 hover:text-slate-700"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="submit"
        className="absolute right-3.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200/80 hover:text-slate-700"
        aria-label="Submit search"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}
