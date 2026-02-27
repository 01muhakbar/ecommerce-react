import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { GENERIC_ERROR, UPDATING } from "../../../constants/uiMessages.js";

const toNumber = (value) => {
  const numeric = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const toDateInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const deriveActive = (coupon) => {
  if (typeof coupon?.active === "boolean") return coupon.active;
  if (typeof coupon?.published === "boolean") return coupon.published;
  return true;
};

export default function EditCouponDrawer({
  open,
  onClose,
  coupon,
  onSubmit,
  isSubmitting,
  error,
}) {
  const [language, setLanguage] = useState("en");
  const [discountType, setDiscountType] = useState("percent");
  const [amount, setAmount] = useState("");
  const [minSpend, setMinSpend] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [active, setActive] = useState(true);
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open || !coupon) return;
    setLanguage("en");
    setDiscountType(coupon.discountType || "percent");
    setAmount(String(coupon.amount ?? ""));
    setMinSpend(String(coupon.minSpend ?? ""));
    setStartDate(toDateInput(coupon.startDate || coupon.startsAt || coupon.createdAt));
    setEndDate(toDateInput(coupon.endDate || coupon.expiresAt || coupon.endsAt));
    setActive(deriveActive(coupon));
    setValidationError("");
  }, [open, coupon]);

  const discountInputAffix = useMemo(() => {
    if (discountType === "fixed") {
      return { prefix: "Rp", suffix: "" };
    }
    return { prefix: "", suffix: "%" };
  }, [discountType]);

  const submitError = validationError || error || "";

  const handleSubmit = (event) => {
    event.preventDefault();
    const parsedAmount = toNumber(amount);
    const parsedMinSpend = toNumber(minSpend);

    if (discountType === "percent" && (parsedAmount < 0 || parsedAmount > 100)) {
      setValidationError("Percent discount must be between 0 and 100.");
      return;
    }
    if (discountType === "fixed" && parsedAmount <= 0) {
      setValidationError("Discount must be greater than 0.");
      return;
    }
    if (discountType === "percent" && parsedAmount <= 0) {
      setValidationError("Percent discount must be greater than 0.");
      return;
    }
    if (parsedMinSpend < 0) {
      setValidationError("Minimum Amount must be greater than or equal to 0.");
      return;
    }
    if (endDate) {
      const parsedEnd = new Date(`${endDate}T23:59:59`);
      if (Number.isNaN(parsedEnd.getTime())) {
        setValidationError("Coupon Validity Time is invalid.");
        return;
      }
      if (startDate) {
        const parsedStart = new Date(startDate);
        if (!Number.isNaN(parsedStart.getTime()) && parsedEnd < parsedStart) {
          setValidationError("End Date must be greater than or equal to Start Date.");
          return;
        }
      }
    }

    setValidationError("");
    onSubmit({
      discountType,
      amount: parsedAmount,
      minSpend: parsedMinSpend,
      active: Boolean(active),
      expiresAt: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : null,
    });
  };

  if (!open || !coupon) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Close update coupon drawer"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Update Coupon</h2>
              <p className="mt-1 text-sm text-slate-500">
                Update coupon validity and discount settings.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isSubmitting && onClose()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close drawer"
              disabled={isSubmitting}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 max-w-[220px]">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Language
            </label>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
              disabled={isSubmitting}
            >
              <option value="en">English</option>
              <option value="id">Bahasa Indonesia</option>
            </select>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Campaign Code
              </label>
              <input
                value={coupon.code || ""}
                readOnly
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Coupon Validity Time
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Discount Type
              </label>
              <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setValidationError("");
                    setDiscountType("percent");
                  }}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${
                    discountType === "percent"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  disabled={isSubmitting}
                >
                  Percent
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValidationError("");
                    setDiscountType("fixed");
                  }}
                  className={`h-10 rounded-lg text-sm font-semibold transition ${
                    discountType === "fixed"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-slate-600 hover:text-slate-800"
                  }`}
                  disabled={isSubmitting}
                >
                  Fixed
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Discount
                </label>
                <div className="relative">
                  {discountInputAffix.prefix ? (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      {discountInputAffix.prefix}
                    </span>
                  ) : null}
                  <input
                    type="number"
                    min={discountType === "percent" ? 0 : 0}
                    max={discountType === "percent" ? 100 : undefined}
                    step="1"
                    value={amount}
                    onChange={(event) => {
                      setValidationError("");
                      setAmount(event.target.value);
                    }}
                    className={`h-11 w-full rounded-xl border border-slate-200 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none ${
                      discountInputAffix.prefix ? "pl-10 pr-3" : "pl-3 pr-10"
                    }`}
                    disabled={isSubmitting}
                    required
                  />
                  {discountInputAffix.suffix ? (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                      {discountInputAffix.suffix}
                    </span>
                  ) : null}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Minimum Amount
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minSpend}
                    onChange={(event) => {
                      setValidationError("");
                      setMinSpend(event.target.value);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">Published</p>
                  <p className="text-xs text-slate-500">Enable coupon for checkout immediately</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setValidationError("");
                    setActive((prev) => !prev);
                  }}
                  disabled={isSubmitting}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    active ? "bg-emerald-500" : "bg-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                  aria-label="Toggle published"
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      active ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>

            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError || GENERIC_ERROR}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:border-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? UPDATING : "Update Coupon"}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
