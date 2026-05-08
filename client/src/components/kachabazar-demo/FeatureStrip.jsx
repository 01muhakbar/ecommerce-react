const DEFAULT_PROMOS = [
  "Free Shipping From €500.00",
  "Support 24/7 At Anytime",
  "Secure Payment Totally Safe",
  "Latest Offer Upto 20% Off",
];

const normalizePromoItems = (...items) => {
  const normalized = items
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
  return normalized.length > 0 ? normalized : DEFAULT_PROMOS;
};

export default function FeatureStrip({
  freeShippingText,
  supportText,
  securePaymentText,
  latestOfferText,
}) {
  const promoItems = normalizePromoItems(
    freeShippingText,
    supportText,
    securePaymentText,
    latestOfferText
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {promoItems.map((item, index) => (
          <div
            key={`${index}-${item}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p className="text-sm font-semibold leading-6 text-slate-900">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
