export default function CouponPanel({
  couponList,
  couponError,
  copiedCode,
  onCopy,
}) {
  return (
    <div className="flex min-h-[360px] flex-col rounded-2xl border-2 border-orange-300 bg-orange-50/60 p-5 shadow-sm">
      <h2 className="px-3 text-center text-sm font-semibold leading-6 text-orange-700">
        Latest Super Discount Active Coupon Code
      </h2>
      <div className="mt-4 flex flex-1 flex-col justify-center space-y-3 text-sm text-orange-900">
        {(couponList || []).length === 0 ? (
          <div className="rounded-xl border border-orange-100 bg-white px-3 py-6 text-center text-xs text-slate-500">
            No active coupons right now.
          </div>
        ) : (
          (couponList || []).slice(0, 2).map((coupon, index) => (
            <div
              key={coupon.code || coupon.id || index}
              className="flex items-center justify-between rounded-2xl border border-orange-100 bg-white p-3 shadow-sm"
            >
              <div>
                <div className="text-xs font-semibold text-orange-600">{coupon.code}</div>
                <div className="text-xs text-slate-600">{coupon.label}</div>
              </div>
              <button
                type="button"
                onClick={() => onCopy(coupon.code)}
                className="rounded-full border border-orange-200 px-3 py-1 text-[11px] font-semibold text-orange-700"
              >
                {copiedCode === coupon.code ? "Copied" : "Copy"}
              </button>
            </div>
          ))
        )}
        {couponError ? (
          <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600">
            {couponError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
