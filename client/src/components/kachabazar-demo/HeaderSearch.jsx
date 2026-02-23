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
      className={`relative w-full rounded-full transition focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100 ${
        isDesktop
          ? "h-[44px] border border-white/40 bg-white shadow-sm lg:h-[46px]"
          : "h-11 border border-slate-200 bg-white shadow-sm sm:h-12"
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
        className={`h-full w-full rounded-full bg-transparent pl-5 pr-16 text-[13px] outline-none placeholder:text-slate-400 sm:text-sm ${
          isDesktop ? "text-slate-700" : "text-slate-700"
        }`}
      />
      {search ? (
        <button
          type="button"
          onClick={() => setSearch("")}
          className="absolute right-11 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      <button
        type="submit"
        className="absolute right-4 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
        aria-label="Submit search"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </form>
  );
}
