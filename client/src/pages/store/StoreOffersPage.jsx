import { useEffect, useState } from "react";
import { fetchStoreCoupons } from "../../api/store.service.ts";
import { formatCurrency } from "../../utils/format.js";

const formatDiscount = (coupon) => {
  if (!coupon) return "-";
  if (coupon.discountType === "percent") {
    return `${Number(coupon.amount || 0)}% OFF`;
  }
  return `${formatCurrency(Number(coupon.amount || 0))} OFF`;
};

export default function StoreOffersPage() {
  const [coupons, setCoupons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetchStoreCoupons();
        if (!active) return;
        setCoupons(response.data || []);
      } catch (err) {
        if (!active) return;
        setError("Failed to load offers.");
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const copyCode = async (code) => {
    if (!code) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = code;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch (_) {
      setCopied("");
    }
  };

  if (isLoading) {
    return (
      <section>
        <h1>Offers</h1>
        <p>Loading offers...</p>
      </section>
    );
  }

  if (error) {
    return (
      <section>
        <h1>Offers</h1>
        <p style={{ color: "crimson" }}>{error}</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Offers & Coupons</h1>
        <p className="text-sm text-slate-500">Use these codes at checkout.</p>
      </div>

      {coupons.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-500">
          No active offers right now.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {coupons.map((coupon) => (
            <div
              key={coupon.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-slate-400">Coupon</div>
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                  {formatDiscount(coupon)}
                </span>
              </div>
              <div className="mt-3 text-2xl font-semibold text-slate-900">
                {coupon.code}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Min spend: {formatCurrency(Number(coupon.minSpend || 0))}
              </div>
              {coupon.expiresAt ? (
                <div className="mt-1 text-xs text-slate-500">
                  Expires: {new Date(coupon.expiresAt).toLocaleDateString("id-ID")}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => copyCode(coupon.code)}
                className="mt-4 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:border-slate-300"
              >
                {copied === coupon.code ? "Copied!" : "Copy Code"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
