import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import HeaderSearch from "./HeaderSearch.jsx";
import HeaderActions from "./HeaderActions.jsx";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const withVersion = (url, version) => {
  const resolved = String(url || "").trim();
  if (!resolved || !version) return resolved;
  const separator = resolved.includes("?") ? "&" : "?";
  return `${resolved}${separator}v=${encodeURIComponent(version)}`;
};

export default function GreenHeaderBar({
  search,
  setSearch,
  onSubmit,
  totalQty,
  isAuthenticated,
  onCartClick,
  headerLogoUrl = "",
  logoUpdatedAt = "",
  isHeaderLoading = false,
}) {
  const logoSrc = withVersion(resolveAssetUrl(headerLogoUrl), toText(logoUpdatedAt));
  const logoFrameClass =
    "inline-flex h-10 w-[144px] items-center sm:h-11 sm:w-[156px] md:h-12 md:w-[172px]";

  return (
    <div className="border-b border-emerald-700/45 bg-emerald-600 text-white shadow-[0_6px_20px_rgba(5,150,105,0.24)]">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 sm:py-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:gap-x-4 md:gap-y-0 lg:px-6">
        <Link
          to="/"
          className="inline-flex h-10 min-w-0 items-center gap-2 text-[13px] font-extrabold tracking-[0.08em] text-white sm:h-11 sm:gap-2.5 sm:text-[15px]"
          aria-label="Go to homepage"
        >
          {logoSrc ? (
            <span className={logoFrameClass}>
              <img
                src={logoSrc}
                alt="Store logo"
                className="max-h-full w-auto max-w-full object-contain"
              />
            </span>
          ) : isHeaderLoading ? (
            <span className={`${logoFrameClass} rounded bg-white/20`} />
          ) : (
            <span className={`${logoFrameClass} gap-2 sm:gap-2.5`}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/35 bg-white/10 sm:h-8 sm:w-8">
                <Lock className="h-[15px] w-[15px] sm:h-4 sm:w-4" />
              </span>
              <span className="truncate leading-none">KACHA BAZAR</span>
            </span>
          )}
        </Link>
        <div className="col-span-2 md:col-span-1 md:min-w-0 md:px-1 lg:px-3">
          <HeaderSearch
            search={search}
            setSearch={setSearch}
            onSubmit={onSubmit}
            variant="desktop"
            placeholder="Search for products (e.g. fish, apple, baby care)"
          />
        </div>
        <HeaderActions
          className="justify-self-end"
          totalQty={totalQty}
          isAuthenticated={isAuthenticated}
          onCartClick={onCartClick}
        />
      </div>
    </div>
  );
}
