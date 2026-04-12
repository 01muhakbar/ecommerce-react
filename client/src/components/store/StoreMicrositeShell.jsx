import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircleMore,
  Package,
  PhoneCall,
  Star,
  Store as StoreIcon,
} from "lucide-react";
import { resolveAssetUrl } from "../../lib/assetUrl.js";
import StoreHeaderKacha from "../kachabazar-demo/StoreHeaderKacha.jsx";
import { StoreCartDrawer } from "../../pages/store/StoreCartPage.jsx";
import useStoreBranding from "../../hooks/useStoreBranding.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

export const buildStoreMicrositeHref = (slug) =>
  `/store/${encodeURIComponent(toText(slug))}`;

export const buildStoreMicrositeProductHref = (slug, productSlug) =>
  `${buildStoreMicrositeHref(slug)}/products/${encodeURIComponent(toText(productSlug))}`;

const toWhatsAppHref = (value) => {
  const safeValue = toText(value);
  if (!safeValue) return "";
  return /^https?:\/\//i.test(safeValue)
    ? safeValue
    : `https://wa.me/${safeValue.replace(/\D+/g, "")}`;
};

const toExternalHref = (value) => {
  const safeValue = toText(value);
  return /^https?:\/\//i.test(safeValue) ? safeValue : "";
};

const formatStoreAddress = (identity) => {
  const lineOne = toText(identity?.addressLine1);
  const lineTwo = toText(identity?.addressLine2);
  const locality = [identity?.city, identity?.province, identity?.postalCode]
    .map((item) => toText(item))
    .filter(Boolean)
    .join(", ");
  const country = toText(identity?.country);
  return [lineOne, lineTwo, locality, country].filter(Boolean).join(", ");
};

const formatJoinedLabel = (value) => {
  const safeValue = toText(value);
  if (!safeValue) return "";
  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const buildContactActions = (identity) => {
  const whatsappHref = toWhatsAppHref(identity?.whatsapp);
  return [
    identity?.whatsapp
      ? {
          key: "whatsapp",
          label: "Chat",
          href: whatsappHref,
          external: true,
          tone: "primary",
          Icon: MessageCircleMore,
        }
      : null,
    identity?.email
      ? {
          key: "email",
          label: "Email",
          href: `mailto:${identity.email}`,
          external: false,
          tone: "secondary",
          Icon: Mail,
        }
      : null,
    identity?.phone
      ? {
          key: "phone",
          label: "Call",
          href: `tel:${identity.phone}`,
          external: false,
          tone: "secondary",
          Icon: PhoneCall,
        }
      : null,
  ].filter(Boolean);
};

const buildPublicProfileLinks = (identity) =>
  [
    identity?.websiteUrl
      ? {
          key: "website",
          label: "Website",
          href: toExternalHref(identity.websiteUrl),
        }
      : null,
    identity?.instagramUrl
      ? {
          key: "instagram",
          label: "Instagram",
          href: toExternalHref(identity.instagramUrl),
        }
      : null,
    identity?.tiktokUrl
      ? {
          key: "tiktok",
          label: "TikTok",
          href: toExternalHref(identity.tiktokUrl),
        }
      : null,
  ].filter((item) => Boolean(item?.href));

const buildSummaryItems = (identity) => {
  const summary = identity?.summary || {};
  const items = [];

  if (Number.isFinite(Number(summary.productCount))) {
    items.push({
      key: "products",
      label: "Products",
      value: String(Number(summary.productCount)),
      subtext: "public",
      Icon: Package,
    });
  }

  if (Number.isFinite(Number(summary.ratingAverage)) && Number(summary.ratingAverage) > 0) {
    const ratingCount = Math.max(0, Number(summary.ratingCount || 0));
    items.push({
      key: "rating",
      label: "Rating",
      value: `${Number(summary.ratingAverage).toFixed(1)} / 5`,
      subtext: `${ratingCount} review${ratingCount === 1 ? "" : "s"}`,
      Icon: Star,
    });
  }

  const joinedLabel = formatJoinedLabel(summary.joinedAt || identity?.createdAt);
  if (joinedLabel) {
    items.push({
      key: "joined",
      label: "Joined",
      value: joinedLabel,
      subtext: "store age",
      Icon: CalendarDays,
    });
  }

  return items;
};

export default function StoreMicrositeShell({
  identity,
  safeSlug,
  currentLabel = "",
  description = "",
  actions = null,
  navigationItems = [],
  children,
  compact = false,
}) {
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const location = useLocation();
  const { branding } = useStoreBranding();
  const storeName = toText(identity?.name, "Store");
  const storeSlug = toText(identity?.slug, safeSlug);
  const storeHref = buildStoreMicrositeHref(storeSlug || safeSlug);
  const logoSrc = resolveAssetUrl(identity?.logoUrl);
  const bannerSrc = resolveAssetUrl(identity?.bannerUrl);
  const contactActions = buildContactActions(identity);
  const publicProfileLinks = buildPublicProfileLinks(identity);
  const summaryItems = buildSummaryItems(identity);
  const addressText = formatStoreAddress(identity);
  const hasCurrentLabel = toText(currentLabel) && toText(currentLabel) !== storeName;
  const statusLabel = toText(identity?.summary?.status?.label, "Active");
  const statusTone = toText(identity?.summary?.status?.tone, "success");
  const statusClass =
    statusTone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-white/20 bg-white/10 text-white";

  useEffect(() => {
    if (!isCartDrawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsCartDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartDrawerOpen]);

  useEffect(() => {
    const hash = toText(location.hash).replace(/^#/, "");
    if (!hash) return;

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(hash);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <StoreHeaderKacha
        onCartClick={() => setIsCartDrawerOpen(true)}
        publicIdentityOverride={identity}
        brandingLogoUrl={branding.clientLogoUrl}
      />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-700">
            Marketplace
          </Link>
          <ChevronRight className="h-4 w-4 text-slate-300" />
          {hasCurrentLabel ? (
            <>
              <Link to={storeHref} className="hover:text-slate-700">
                {storeName}
              </Link>
              <ChevronRight className="h-4 w-4 text-slate-300" />
              <span className="font-medium text-slate-700">{currentLabel}</span>
            </>
          ) : (
            <span className="font-medium text-slate-700">{storeName}</span>
          )}
        </nav>

        <section
          id="store-home"
          className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)]"
        >
          <div
            className={`relative overflow-hidden text-white ${
              compact ? "px-5 py-5 sm:px-6 sm:py-6" : "px-6 py-5 sm:px-7 sm:py-6"
            }`}
          >
            {bannerSrc ? (
              <img
                src={bannerSrc}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null}
            <div
              className={`absolute inset-0 ${
                bannerSrc
                  ? "bg-gradient-to-r from-emerald-950/85 via-emerald-800/80 to-emerald-600/75"
                  : "bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-500"
              }`}
            />
            <div
              className={`relative grid gap-4 ${
                compact
                  ? "lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
                  : "lg:grid-cols-[minmax(0,1fr)_minmax(360px,460px)]"
              } lg:items-start`}
            >
              <div className="flex items-start gap-4 sm:gap-5">
                <div
                  className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-white/15 bg-white/10 ${
                    compact ? "h-16 w-16" : "h-18 w-18 sm:h-20 sm:w-20"
                  }`}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={`${storeName} logo`}
                      className="h-full w-full object-contain p-2"
                    />
                  ) : (
                    <StoreIcon className={`${compact ? "h-7 w-7" : "h-9 w-9"} text-white/80`} />
                  )}
                </div>

                <div className="min-w-0 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-7 items-center rounded-full border border-white/15 bg-white/10 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90">
                      {compact ? "Store" : "Store Home"}
                    </span>
                    <span
                      className={`inline-flex h-7 items-center rounded-full border px-3 text-[11px] font-semibold uppercase tracking-[0.16em] ${
                        compact && statusTone !== "success" ? statusClass : statusClass
                      }`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div>
                    <h1
                      className={`break-words font-extrabold tracking-tight ${
                        compact ? "text-2xl sm:text-3xl" : "text-[28px] sm:text-[34px]"
                      }`}
                    >
                      {storeName}
                    </h1>
                    <p className="mt-1 text-sm text-emerald-50/90">@{storeSlug || safeSlug}</p>
                  </div>

                  {description ? (
                    <p className="max-w-2xl text-sm leading-6 text-emerald-50/95">{description}</p>
                  ) : null}

                  {!compact && addressText ? (
                    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-sm text-white/90">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{addressText}</span>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      to={`?view=products#store-products`}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      Products
                    </Link>
                    <Link
                      to="/"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
                    >
                      Marketplace
                    </Link>
                    {hasCurrentLabel ? (
                      <Link
                        to={storeHref}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Back
                      </Link>
                    ) : null}
                    {actions}
                  </div>

                </div>
              </div>

              {summaryItems.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-3">
                  {summaryItems.map((item) => (
                    <div
                      key={item.key}
                      className="rounded-[22px] border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-50/80">
                            {item.label}
                          </p>
                          <p className="mt-1 text-lg font-bold text-white">{item.value}</p>
                          <p className="mt-0.5 text-xs text-emerald-50/80">{item.subtext}</p>
                        </div>
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white">
                          <item.Icon className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap gap-2">
                {contactActions.length > 0 || publicProfileLinks.length > 0 ? (
                  <>
                    {contactActions.map((item) => {
                      const className =
                        item.tone === "primary"
                          ? "inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                          : "inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50";

                      return (
                        <a
                          key={item.key}
                          href={item.href}
                          target={item.external ? "_blank" : undefined}
                          rel={item.external ? "noreferrer" : undefined}
                          className={className}
                        >
                          <item.Icon className="h-4 w-4" />
                          {item.label}
                        </a>
                      );
                    })}
                    {publicProfileLinks.map((item) => (
                      <a
                        key={item.key}
                        href={item.href}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {item.label}
                      </a>
                    ))}
                  </>
                ) : (
                  <span className="inline-flex h-10 items-center rounded-full border border-dashed border-slate-300 px-4 text-sm text-slate-500">
                    Public contact and store links are not available yet.
                  </span>
                )}
              </div>
            </div>

            {!compact && navigationItems.length > 0 ? (
              <div className="border-t border-slate-200 pt-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {navigationItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`inline-flex h-10 items-center justify-center border-b-2 px-1 text-sm font-semibold transition ${
                        item.active
                          ? "border-emerald-600 text-slate-900"
                          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700"
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {children}
      </main>
      <StoreCartDrawer
        isOpen={isCartDrawerOpen}
        onClose={() => setIsCartDrawerOpen(false)}
      />
    </div>
  );
}
