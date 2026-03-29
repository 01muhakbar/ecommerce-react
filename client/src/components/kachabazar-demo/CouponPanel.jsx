import heroBannerImage from "../../assets/admin-login-hero.jpg";

export default function CouponPanel({
  title = "Latest Super Discount Active Coupon Code",
  couponList,
  isLoading = false,
  couponError,
  copiedCode,
  onCopy,
}) {
  const safeCoupons = Array.isArray(couponList) ? couponList.slice(0, 2) : [];

  return (
    <aside className="rounded-[28px] border border-slate-200/90 bg-white/95 p-4 shadow-[0_14px_24px_-28px_rgba(15,23,42,0.45)] sm:p-5">
      <h2 className="text-center text-[13px] font-semibold leading-6 text-slate-800 sm:text-[14px]">
        {title}
      </h2>
      <div className="mt-3 space-y-3">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-xs text-slate-500">
            Loading active coupons...
          </div>
        ) : safeCoupons.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-xs text-slate-500">
            {couponError || "No active coupons right now."}
          </div>
        ) : (
          safeCoupons.map((coupon, index) => (
            <div
              key={coupon.code || coupon.id || index}
              className="rounded-[24px] border border-slate-200/90 bg-slate-50/60 p-3"
            >
              <div className="flex items-start gap-3">
                <img
                  src={coupon.thumbnail || heroBannerImage}
                  alt={coupon.title || coupon.code || "Coupon"}
                  className="h-12 w-12 shrink-0 rounded-[18px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-md bg-rose-100/90 px-2 py-0.5 text-[10px] font-semibold text-rose-600">
                      {coupon.discountLabel || "10% Off"}
                    </span>
                    {coupon.status ? (
                      <span className="inline-flex rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                        {coupon.status}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1.5 text-[11px] font-semibold leading-5 text-slate-800">
                    {coupon.title || coupon.label || "Special voucher for your order"}
                  </div>
                  <div className="mt-1 text-[10px] font-medium tracking-wide text-slate-400">
                    {coupon.countdown || "00 : 00 : 00 : 00"}
                  </div>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="inline-flex h-8 items-center rounded-full bg-emerald-600 px-3 text-[10px] font-semibold tracking-[0.08em] text-white">
                  {coupon.code}
                </div>
                <button
                  type="button"
                  onClick={() => onCopy(coupon.code)}
                  className="inline-flex h-8 items-center rounded-full border border-emerald-200 bg-white px-3 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50"
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
