import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const toneClassMap = {
  rose: "bg-rose-50 text-rose-700 ring-1 ring-rose-100",
  amber: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  emerald: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
};

const resolveToneClass = (tone) => toneClassMap[tone] || toneClassMap.emerald;

const splitDiscountLabel = (label) => {
  const text = String(label || "").trim();
  if (!text) return { amountText: "-", suffixText: "" };
  const match = text.match(/^(.*?)(\s+off)$/i);
  if (!match) return { amountText: text, suffixText: "" };
  return {
    amountText: String(match[1] || "").trim() || text,
    suffixText: String(match[2] || "").trim(),
  };
};

const formatCountdownParts = (expiresAt, now) => {
  const target = Date.parse(String(expiresAt || ""));
  if (!Number.isFinite(target)) {
    return ["00", "00", "00", "00"];
  }
  const remainingMs = Math.max(0, target - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [days, hours, minutes, seconds].map((value) => String(value).padStart(2, "0"));
};

const resolveCountdownToneClass = (expiresAt, now, fallbackTone) => {
  const target = Date.parse(String(expiresAt || ""));
  if (!Number.isFinite(target)) {
    return fallbackTone === "rose" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white";
  }
  const remainingMs = Math.max(0, target - now);
  if (remainingMs <= 60_000) {
    return "bg-rose-500 text-white";
  }
  return fallbackTone === "rose" ? "bg-rose-500 text-white" : "bg-emerald-500 text-white";
};

function CouponRow({ coupon, copiedCode, onCopy, now, featured = false }) {
  const discount = splitDiscountLabel(coupon?.discountLabel);
  const isCopied = copiedCode === coupon?.code;
  const bannerSrc = String(coupon?.bannerImageUrl || "").trim();
  const countdownParts = formatCountdownParts(coupon?.expiresAt, now);
  const timerClass = resolveCountdownToneClass(coupon?.expiresAt, now, coupon?.statusTone);
  const storeHref = coupon?.storeSlug ? `/store/${encodeURIComponent(coupon.storeSlug)}` : "";

  return (
    <div
      className={`overflow-hidden rounded-[18px] border bg-white ${
        featured
          ? "border-emerald-100/90 shadow-[0_12px_24px_-34px_rgba(15,23,42,0.16)]"
          : "border-slate-200/80 shadow-[0_10px_18px_-38px_rgba(15,23,42,0.12)]"
      }`}
    >
      <div className="flex flex-col sm:flex-row">
        <div className={`min-w-0 flex-1 ${featured ? "p-3.5" : "p-3"}`}>
          <div className="flex items-start gap-3">
            {bannerSrc ? (
              <div className="h-[78px] w-[78px] shrink-0 overflow-hidden rounded-[16px] border border-slate-200 bg-slate-50">
                <img
                  src={bannerSrc}
                  alt={`${coupon.code || "Coupon"} banner`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : null}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-baseline gap-1 text-rose-500">
                  <span className={`font-bold leading-none ${featured ? "text-[18px]" : "text-[17px]"}`}>
                    {discount.amountText}
                  </span>
                  {discount.suffixText ? (
                    <span className="text-sm font-semibold text-slate-500">{discount.suffixText}</span>
                  ) : null}
                </span>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${resolveToneClass(
                    coupon.statusTone
                  )}`}
                >
                  {coupon.statusLabel || "Active"}
                </span>
                {coupon.scopeLabel ? (
                  <span className="inline-flex rounded-full border border-slate-200/80 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {coupon.scopeLabel}
                  </span>
                ) : null}
              </div>

              <div className={`mt-1 text-slate-500 ${featured ? "text-[11px] leading-4" : "text-[10px] leading-4"}`}>
                {coupon?.scopeType === "STORE" ? (
                  <p>
                    Valid only for{" "}
                    {storeHref ? (
                      <Link
                        to={storeHref}
                        className="font-semibold text-emerald-700 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-800"
                      >
                        {coupon?.storeName || "this store"}
                      </Link>
                    ) : (
                      <span className="font-semibold text-slate-700">
                        {coupon?.storeName || "this store"}
                      </span>
                    )}
                    .
                  </p>
                ) : (
                  <p>Valid for orders from all eligible stores.</p>
                )}
              </div>
              <div className="mt-3 grid max-w-[152px] grid-cols-4 gap-1.5">
                {countdownParts.map((part, index) => (
                  <span
                    key={`${coupon.code || "coupon"}-${index}`}
                    className={`inline-flex h-8 min-w-0 items-center justify-center rounded-[8px] px-1.5 text-[12px] font-bold tracking-[0.08em] ${timerClass}`}
                  >
                    {part}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`border-t border-dashed border-slate-200/90 p-3 sm:w-[172px] sm:border-l sm:border-t-0 ${
            featured ? "sm:p-3.5" : "sm:p-3"
          }`}
        >
          <button
            type="button"
            onClick={() => onCopy(coupon.code)}
            className={`w-full rounded-[14px] border border-dashed px-3 py-3 text-center transition ${
              isCopied
                ? "border-emerald-300 bg-emerald-50/90"
                : "border-emerald-300/90 bg-white hover:bg-emerald-50/60"
            }`}
            aria-label={`Copy coupon code ${coupon.code}`}
            title={`Copy ${coupon.code}`}
          >
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-700/75">
              {isCopied ? "Copied!" : "Coupon Code"}
            </p>
            <code className={`mt-1.5 block font-bold tracking-[0.14em] text-emerald-700 ${featured ? "text-[14px]" : "text-[13px]"}`}>
              {coupon.code}
            </code>
          </button>
          <p className={`mt-2 text-slate-500 ${featured ? "text-[10px] leading-4" : "text-[9px] leading-4"}`}>
            Click the code box to copy this active coupon.
          </p>
          <div className={`mt-2.5 space-y-1.5 ${featured ? "text-[10px]" : "text-[9px]"} text-slate-600`}>
            <p>
              <span className="font-semibold text-slate-500">Min Order:</span>{" "}
              <span className="font-semibold text-slate-700">
                {coupon.minimumOrderLabel || "No minimum order"}
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-500">Validity:</span>{" "}
              <span className="font-semibold text-slate-700">
                {coupon.validityLabel || "No expiry limit"}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CouponPanel({
  title = "Latest Super Discount Active Coupon Code",
  couponList,
  isLoading = false,
  couponError,
  storeName = "",
  copiedCode,
  onCopy,
}) {
  const [now, setNow] = useState(() => Date.now());
  const safeCoupons = Array.isArray(couponList) ? couponList.slice(0, 2) : [];
  const hasCoupons = safeCoupons.length > 0;

  useEffect(() => {
    if (!hasCoupons) return undefined;
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasCoupons]);

  return (
    <aside className="overflow-hidden rounded-[24px] border border-emerald-100 bg-white shadow-[0_18px_44px_-42px_rgba(15,23,42,0.2)]">
      <div className="border-b border-emerald-100/70 bg-[linear-gradient(180deg,rgba(241,253,249,0.94),rgba(255,255,255,0.98))] px-4 py-3 text-center sm:px-5">
        <h2 className="mx-auto whitespace-nowrap text-[11px] font-bold leading-5 text-slate-900 sm:text-[13px]">
          {title}
        </h2>
      </div>

      <div className="space-y-2 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,250,252,0.92))] p-2.5 sm:p-3">
        {isLoading ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/90 px-4 py-7 text-center">
            <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
            <p className="mt-3 text-xs font-medium text-slate-500">Loading active coupons...</p>
          </div>
        ) : !hasCoupons ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50/90 px-4 py-7 text-center">
            <div className="mx-auto inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-200/80 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              0
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-800">No active coupons right now</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {couponError ||
                (storeName
                  ? `This storefront currently has no valid active coupons for ${storeName}.`
                  : "This storefront currently has no valid active coupons.")}
            </p>
          </div>
        ) : (
          safeCoupons.map((coupon, index) => (
            <CouponRow
              key={coupon.code || coupon.id || index}
              coupon={coupon}
              copiedCode={copiedCode}
              onCopy={onCopy}
              now={now}
              featured={index === 0}
            />
          ))
        )}

        {couponError && hasCoupons ? (
          <div className="rounded-2xl bg-rose-50 px-3 py-2.5 text-xs text-rose-600">
            {couponError}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
