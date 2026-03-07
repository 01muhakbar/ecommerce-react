import heroBannerImage from "../../assets/admin-login-hero.jpg";

export default function CouponPanel({
  couponList,
  isLoading = false,
  couponError,
  copiedCode,
  onCopy,
}) {
  const safeCoupons = Array.isArray(couponList) ? couponList.slice(0, 2) : [];

  return (
    <aside className="rounded-[28px] border border-orange-300 bg-white p-4 shadow-[0_16px_28px_-26px_rgba(15,23,42,0.5)] sm:p-5">
      <h2 className="text-center text-[14px] font-bold leading-8 text-slate-800 sm:text-[15px]">
        Latest Super Discount Active Coupon Code
      </h2>
      <div className="mt-3.5 space-y-3.5">
        {isLoading ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-6 text-center text-xs text-slate-500">
            Loading active coupons...
          </div>
        ) : safeCoupons.length === 0 ? (
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 px-3 py-6 text-center text-xs text-slate-500">
            {couponError || "No active coupons right now."}
          </div>
        ) : (
          safeCoupons.map((coupon, index) => (
            <div
              key={coupon.code || coupon.id || index}
              className="rounded-3xl border border-orange-200 bg-white p-3.5"
            >
              <div className="flex items-start gap-3.5">
                <img
                  src={coupon.thumbnail || heroBannerImage}
                  alt={coupon.title || coupon.code || "Coupon"}
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                      {coupon.discountLabel || "10% Off"}
                    </span>
                    {coupon.status ? (
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                        {coupon.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 truncate text-[12px] font-semibold text-slate-800">
                    {coupon.title || coupon.label || "Special voucher for your order"}
                  </div>
                  <div className="mt-1 text-[10px] font-medium tracking-wide text-slate-400">
                    {coupon.countdown || "00 : 00 : 00 : 00"}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="inline-flex h-8 items-center rounded-full bg-emerald-600 px-3.5 text-[10px] font-semibold tracking-[0.08em] text-white">
                  {coupon.code}
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(coupon.code)}
                  className="inline-flex h-8 items-center rounded-full border border-emerald-300 bg-white px-3.5 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
                >
                  {copiedCode === coupon.code ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          ))
        )}
        {couponError && safeCoupons.length > 0 ? (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {couponError}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
