import { useEffect, useState } from "react";
import PageHeroBanner from "../../components/store/PageHeroBanner.jsx";
import heroImage from "../../assets/admin-login-hero.jpg";
import { formatStoreMoney } from "../../utils/storeMoneyFormatters.js";

const DEMO_OFFERS = [
  {
    code: "AUGUST24",
    title: "Summer Grocery Coupon",
    discountText: "10% Off For All Items",
    minPurchase: 200,
    isActive: false,
  },
  {
    code: "SUMMER24",
    title: "Fresh Weekend Offer",
    discountText: "15% Off For Selected Items",
    minPurchase: 150,
    isActive: false,
  },
  {
    code: "WINTER25",
    title: "Monthly Essentials",
    discountText: "20% Off For Groceries",
    minPurchase: 250,
    isActive: true,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    code: "SUMMER26",
    title: "Mega Household Promo",
    discountText: "25% Off Household Tools",
    minPurchase: 300,
    isActive: false,
  },
];

const pad2 = (value) => String(value).padStart(2, "0");

const renderCountdown = (offer, now) => {
  if (!offer.isActive || !offer.expiresAt) return "00:00:00:00";
  const diff = new Date(offer.expiresAt).getTime() - now;
  if (!Number.isFinite(diff) || diff <= 0) return "00:00:00:00";
  const sec = Math.floor(diff / 1000);
  const day = Math.floor(sec / 86400);
  const hour = Math.floor((sec % 86400) / 3600);
  const min = Math.floor((sec % 3600) / 60);
  const second = sec % 60;
  return `${pad2(day)}:${pad2(hour)}:${pad2(min)}:${pad2(second)}`;
};

export default function StoreOffersPage() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-10 px-3 py-6 sm:px-4 sm:py-8 lg:px-6">
      <PageHeroBanner
        title="Mega Offer"
        subtitle="Exclusive coupon deals for your next grocery and household shopping."
      />

      <section className="grid gap-4 lg:grid-cols-2">
        {DEMO_OFFERS.map((offer) => (
          <article
            key={offer.code}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <div className="flex flex-col md:flex-row">
              <div className="relative min-h-44 flex-1 bg-slate-900 text-white">
                <img
                  src={heroImage}
                  alt={offer.title}
                  className="absolute inset-0 h-full w-full object-cover opacity-35"
                />
                <div className="relative p-4">
                  <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide">
                    {renderCountdown(offer, now)}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold leading-snug">{offer.title}</h3>
                  <p className="mt-2 text-sm text-white/85">{offer.discountText}</p>
                </div>
              </div>

              <div className="flex w-full items-center justify-center border-y border-dashed border-slate-300 px-4 py-3 md:w-40 md:border-y-0 md:border-x">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    offer.isActive
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-rose-100 text-rose-700"
                  }`}
                >
                  Coupon {offer.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="flex flex-1 flex-col items-start justify-center p-4">
                <div className="rounded-full border border-dashed border-emerald-400 px-4 py-2 text-sm font-extrabold tracking-[0.16em] text-emerald-700">
                  {offer.code}
                </div>
                <p className="mt-3 text-xs leading-6 text-slate-500">
                  Minimum purchase required:{" "}
                  <span className="font-semibold text-slate-700">
                    {formatStoreMoney(offer.minPurchase)}
                  </span>
                </p>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
