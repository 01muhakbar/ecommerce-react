import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getStoreCustomization } from "../../api/public/storeCustomizationPublic.ts";
import { UiEmptyState, UiErrorState } from "../../components/primitives/state/index.js";

const DEFAULT_LANG = "en";
const DEFAULT_OFFERS = {
  pageHeader: {
    enabled: true,
    backgroundImageDataUrl: "",
    pageTitle: "Mega Offer",
  },
  superDiscount: {
    enabled: true,
    activeCouponCode: "ALL",
  },
};

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeOffers = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  const pageHeader =
    source.pageHeader && typeof source.pageHeader === "object" ? source.pageHeader : {};
  const superDiscount =
    source.superDiscount && typeof source.superDiscount === "object"
      ? source.superDiscount
      : {};

  return {
    pageHeader: {
      enabled: toBool(pageHeader.enabled, DEFAULT_OFFERS.pageHeader.enabled),
      backgroundImageDataUrl: toText(
        pageHeader.backgroundImageDataUrl ?? pageHeader.backgroundImage ?? pageHeader.imageDataUrl,
        DEFAULT_OFFERS.pageHeader.backgroundImageDataUrl
      ),
      pageTitle: toText(pageHeader.pageTitle, DEFAULT_OFFERS.pageHeader.pageTitle),
    },
    superDiscount: {
      enabled: toBool(superDiscount.enabled, DEFAULT_OFFERS.superDiscount.enabled),
      activeCouponCode: toText(
        superDiscount.activeCouponCode ?? superDiscount.couponCode,
        DEFAULT_OFFERS.superDiscount.activeCouponCode
      ).toUpperCase(),
    },
  };
};

const getCouponBadgeText = (couponCode) => {
  if (couponCode === "ALL") return "All items are selected.";
  return `Active coupon: ${couponCode}`;
};

function OffersSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <div className="h-48 animate-pulse rounded-3xl bg-slate-200 sm:h-56" />
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-60 animate-pulse rounded-full bg-slate-100" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function StoreOffersPage() {
  const [copyNotice, setCopyNotice] = useState("");
  const lang = DEFAULT_LANG;
  const offersQuery = useQuery({
    queryKey: ["store-customization", "offers-page", lang],
    queryFn: () => getStoreCustomization({ lang, include: "offers" }),
    staleTime: 60_000,
  });

  const offersRaw = offersQuery.data?.customization?.offers;
  const offers = useMemo(() => normalizeOffers(offersRaw), [offersRaw]);

  if (offersQuery.isLoading) return <OffersSkeleton />;

  if (offersQuery.isError) {
    const errorMessage =
      offersQuery.error?.response?.data?.message ||
      offersQuery.error?.message ||
      "Failed to load offers.";
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiErrorState
          title="Failed to load offers."
          message={errorMessage}
          onRetry={() => offersQuery.refetch()}
        />
      </div>
    );
  }

  if (!offersRaw) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="Offers content is not configured yet."
          description="Please check back later."
        />
      </div>
    );
  }

  const isHeaderEnabled = offers.pageHeader.enabled;
  const isSuperDiscountEnabled = offers.superDiscount.enabled;

  if (!isHeaderEnabled && !isSuperDiscountEnabled) {
    return (
      <div className="mx-auto max-w-6xl px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
        <UiEmptyState
          title="Offers page is disabled."
          description="All offers blocks are currently disabled."
        />
      </div>
    );
  }

  const activeCouponCode = offers.superDiscount.activeCouponCode || "ALL";
  const canCopyCouponCode = activeCouponCode !== "ALL";
  const hasBackground = Boolean(offers.pageHeader.backgroundImageDataUrl);

  const onCopyCoupon = async () => {
    if (!canCopyCouponCode || !navigator?.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(activeCouponCode);
      setCopyNotice("Coupon code copied.");
      window.setTimeout(() => setCopyNotice(""), 1800);
    } catch {
      setCopyNotice("Failed to copy code.");
      window.setTimeout(() => setCopyNotice(""), 1800);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      {isHeaderEnabled ? (
        <header
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 px-6 py-12 text-white sm:px-8 sm:py-16"
          style={
            hasBackground
              ? {
                  backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.56), rgba(15, 23, 42, 0.56)), url(${offers.pageHeader.backgroundImageDataUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          <h1 className="text-3xl font-bold sm:text-4xl">{offers.pageHeader.pageTitle}</h1>
        </header>
      ) : null}

      {isSuperDiscountEnabled ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Super Discount Active Coupon Code
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              {getCouponBadgeText(activeCouponCode)}
            </span>
            {canCopyCouponCode ? (
              <button
                type="button"
                onClick={onCopyCoupon}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Copy code
              </button>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Discount applied at checkout when eligible.
          </p>
          {copyNotice ? (
            <p className="mt-2 text-xs text-slate-500">{copyNotice}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
