import { Link } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  MessageCircleMore,
  PhoneCall,
  Store as StoreIcon,
} from "lucide-react";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

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

const buildContactItems = (identity) =>
  [
    identity?.email
      ? {
          key: "email",
          label: "Email",
          value: identity.email,
          href: `mailto:${identity.email}`,
          Icon: Mail,
        }
      : null,
    identity?.phone
      ? {
          key: "phone",
          label: "Phone",
          value: identity.phone,
          href: `tel:${identity.phone}`,
          Icon: PhoneCall,
        }
      : null,
    identity?.whatsapp
      ? {
          key: "whatsapp",
          label: "WhatsApp",
          value: identity.whatsapp,
          href: toWhatsAppHref(identity.whatsapp),
          Icon: MessageCircleMore,
        }
      : null,
  ].filter(Boolean);

export default function StoreMicrositeShell({
  identity,
  safeSlug,
  currentLabel = "",
  description = "",
  actions = null,
  children,
  compact = false,
}) {
  const storeName = toText(identity?.name, "Store");
  const storeSlug = toText(identity?.slug, safeSlug);
  const storeHref = buildStoreMicrositeHref(storeSlug || safeSlug);
  const logoSrc = resolveAssetUrl(identity?.logoUrl);
  const contactItems = buildContactItems(identity);
  const addressText = formatStoreAddress(identity);
  const hasCurrentLabel = toText(currentLabel) && toText(currentLabel) !== storeName;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
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

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.08)]">
          <div
            className={`bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-700 text-white ${
              compact ? "px-5 py-5 sm:px-6 sm:py-6" : "px-6 py-7 sm:px-8 sm:py-8"
            }`}
          >
            <div
              className={`flex flex-col gap-5 ${
                compact ? "lg:flex-row lg:items-center lg:justify-between" : "sm:flex-row sm:items-center"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex items-center justify-center overflow-hidden rounded-[28px] border border-white/20 bg-white/10 ${
                    compact ? "h-16 w-16" : "h-24 w-24"
                  }`}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt={`${storeName} logo`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <StoreIcon className={`${compact ? "h-7 w-7" : "h-10 w-10"} text-white/80`} />
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-50">
                    Store Microsite
                  </p>
                  <div>
                    <h1
                      className={`font-extrabold tracking-tight ${
                        compact ? "text-2xl sm:text-3xl" : "text-2xl sm:text-3xl lg:text-4xl"
                      }`}
                    >
                      {storeName}
                    </h1>
                    <p className="mt-1 text-sm text-emerald-50">
                      Route: /store/{storeSlug || safeSlug}
                    </p>
                  </div>
                  {description ? (
                    <p className="max-w-2xl text-sm leading-6 text-emerald-50">{description}</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {hasCurrentLabel ? (
                  <Link
                    to={storeHref}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back to Store
                  </Link>
                ) : null}
                <Link
                  to="/"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/20 bg-white px-4 text-sm font-semibold text-emerald-700 hover:bg-emerald-50"
                >
                  Global Marketplace
                </Link>
                {actions}
              </div>
            </div>
          </div>

          <div className="px-5 py-5 sm:px-6 sm:py-6">
            {contactItems.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-3">
                {contactItems.map((item) => (
                  <a
                    key={item.key}
                    href={item.href}
                    target={item.key === "whatsapp" ? "_blank" : undefined}
                    rel={item.key === "whatsapp" ? "noreferrer" : undefined}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <item.Icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 break-all text-sm font-semibold text-slate-900">
                      {item.value}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                This store has not published public contact details yet.
              </div>
            )}

            {!compact ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Store Contact
                  </p>
                  <h2 className="mt-2 text-lg font-bold text-slate-900">
                    Reach {storeName} directly
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This section belongs to the store microsite. Marketplace-wide support,
                    policies, and general contact remain on the global contact page.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {identity?.email ? (
                      <a
                        href={`mailto:${identity.email}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Email Store
                      </a>
                    ) : null}
                    {identity?.phone ? (
                      <a
                        href={`tel:${identity.phone}`}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        Call Store
                      </a>
                    ) : null}
                    {identity?.whatsapp ? (
                      <a
                        href={toWhatsAppHref(identity.whatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-10 items-center justify-center rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                      >
                        WhatsApp Store
                      </a>
                    ) : null}
                    <Link
                      to="/contact-us"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Marketplace Contact
                    </Link>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Store Address
                  </p>
                  {addressText ? (
                    <div className="mt-3 flex gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                        <MapPin className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{storeName}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{addressText}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                      This store has not published a public address yet.
                    </div>
                  )}
                </section>
              </div>
            ) : null}
          </div>
        </section>

        {children}
      </main>
    </div>
  );
}
