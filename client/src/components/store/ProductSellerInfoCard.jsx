import { Link } from "react-router-dom";
import {
  BadgeCheck,
  CalendarDays,
  ImageIcon,
  MessageCircleMore,
  MessageSquareText,
  Package,
  Star,
  Store,
} from "lucide-react";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const formatMonthYear = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
};

const formatMetricValue = (value, fallback = "-") => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed.toLocaleString("en-US");
};

const formatRating = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toFixed(1);
};

function SellerLogo({ logoUrl, name }) {
  const resolved = resolveAssetUrl(logoUrl);

  if (!resolved) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-400 sm:h-[68px] sm:w-[68px]">
        <ImageIcon className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={resolved}
      alt={name || "Store"}
      className="h-16 w-16 rounded-2xl border border-slate-200 object-cover sm:h-[68px] sm:w-[68px]"
    />
  );
}

export default function ProductSellerInfoCard({ sellerInfo }) {
  if (!sellerInfo?.name) return null;

  const description = toText(sellerInfo.shortDescription);
  const joinedLabel = formatMonthYear(sellerInfo.joinedAt);
  const productCount =
    Number.isFinite(Number(sellerInfo.productCount)) && Number(sellerInfo.productCount) >= 0
      ? Number(sellerInfo.productCount)
      : null;
  const ratingAverage = formatRating(sellerInfo.ratingAverage);
  const ratingCount = Math.max(0, Number(sellerInfo.ratingCount || 0));
  const statusLabel = toText(sellerInfo?.status?.label);
  const statusTone =
    sellerInfo?.status?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-slate-200 bg-slate-100 text-slate-600";
  const reviewLabel = `${formatMetricValue(ratingCount, "0")} review${ratingCount === 1 ? "" : "s"}`;
  const isChatEnabled = sellerInfo.chatMode === "enabled" && sellerInfo.chatHref;
  const isChatFallback = sellerInfo.chatMode === "contact_fallback" && sellerInfo.chatHref;
  const chatButtonLabel = sellerInfo.chatMode === "disabled" ? "Chat Soon" : "Chat";
  const chatHelper =
    sellerInfo.chatMode === "contact_fallback"
      ? "Use the store page to get in touch."
      : sellerInfo.chatMode === "disabled"
        ? "Chat not available yet."
        : "";

  const metrics = [
    productCount !== null
      ? {
          key: "products",
          label: "Products",
          value: formatMetricValue(productCount),
          helper: "public",
        }
      : null,
    ratingAverage
      ? {
          key: "rating",
          label: "Rating",
          value: `${ratingAverage} / 5`,
          helper: reviewLabel,
        }
      : null,
    joinedLabel
      ? {
          key: "joined",
          label: "Joined",
          value: joinedLabel,
        }
      : null,
  ].filter(Boolean);

  return (
    <section className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 shadow-[0_6px_14px_rgba(15,23,42,0.03)] sm:px-5 sm:py-[18px]">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(210px,0.95fr)_minmax(0,1.35fr)] lg:items-center lg:gap-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Store Info
          </p>
          <div className="mt-2.5 flex items-start gap-3">
            <SellerLogo logoUrl={sellerInfo.logoUrl} name={sellerInfo.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h3 className="truncate text-lg font-bold tracking-tight text-slate-900 sm:text-[22px]">
                  {sellerInfo.name}
                </h3>
                {statusLabel ? (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] ${statusTone}`}
                  >
                    <BadgeCheck className="h-2.5 w-2.5" />
                    {statusLabel}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-2 max-w-xl text-[13px] leading-5 text-slate-500">
                {description || "Sold by this store."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 lg:border-l lg:border-slate-200 lg:px-5">
          <div className="flex flex-wrap gap-1.5">
            {isChatEnabled ? (
              <a
                href={sellerInfo.chatHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 px-3.5 text-[13px] font-semibold text-white transition hover:border-emerald-700 hover:bg-emerald-700"
              >
                <MessageCircleMore className="mr-1.5 h-3.5 w-3.5" />
                {chatButtonLabel}
              </a>
            ) : isChatFallback ? (
              <Link
                to={sellerInfo.chatHref}
                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3.5 text-[13px] font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <MessageCircleMore className="mr-1.5 h-3.5 w-3.5" />
                {chatButtonLabel}
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-3.5 text-[13px] font-semibold text-slate-400"
              >
                <MessageCircleMore className="mr-1.5 h-3.5 w-3.5" />
                {chatButtonLabel}
              </button>
            )}

            {sellerInfo.canVisitStore && sellerInfo.visitStoreHref ? (
              <Link
                to={sellerInfo.visitStoreHref}
                className="inline-flex h-9 items-center justify-center rounded-full border border-slate-300 bg-white px-3.5 text-[13px] font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
              >
                <Store className="mr-1.5 h-3.5 w-3.5" />
                Visit Store
              </Link>
            ) : null}
          </div>

          {chatHelper ? (
            <p className="flex items-start gap-1.5 text-[11px] leading-4 text-slate-400">
              <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0 text-slate-300" />
              <span>{chatHelper}</span>
            </p>
          ) : null}
        </div>

        <div className="lg:border-l lg:border-slate-200 lg:pl-5">
          {metrics.length > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {metrics.map((metric) => (
                <div key={metric.key} className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {metric.label}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1">
                    {metric.key === "rating" ? (
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    ) : metric.key === "products" ? (
                      <Package className="h-3 w-3 text-slate-400" />
                    ) : (
                      <CalendarDays className="h-3 w-3 text-slate-400" />
                    )}
                    <p className="truncate text-[13px] font-semibold text-slate-900 sm:text-sm">
                      {metric.value}
                    </p>
                  </div>
                  {metric.helper ? (
                    <p className="mt-0.5 text-[11px] text-slate-500">{metric.helper}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] leading-5 text-slate-500">
              Only verified public store metrics are shown here.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
