export default function CouponPanel({
  couponList,
  couponError,
  copiedCode,
  onCopy,
}) {
  return (
    <div className="flex flex-col justify-between rounded-3xl border-2 border-orange-200 bg-orange-50 p-6">
      <h2 className="text-sm font-semibold text-orange-700">
        Latest Super Discount Active Coupon Code
      </h2>
      <div className="mt-4 flex flex-1 flex-col justify-center space-y-3 text-sm text-orange-900">
        {(couponList || []).length === 0 ? (
          <div className="rounded-xl bg-white px-3 py-6 text-center text-xs text-slate-500">
            No active coupons right now.
          </div>
        ) : (
          (couponList || []).slice(0, 3).map((coupon) => (
            <div
              key={coupon.id}
              className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm"
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
