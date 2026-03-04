import { useEffect, useMemo, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";
import { GENERIC_ERROR } from "../../../constants/uiMessages.js";

const initialForm = {
  language: "en",
  campaignName: "",
  code: "",
  startDate: "",
  endDate: "",
  discountType: "percent",
  amount: "",
  minSpend: "",
  active: true,
};

const toNumber = (value) => {
  const numeric = Number(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const sectionCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

export default function AddCouponDrawer({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}) {
  const [form, setForm] = useState(initialForm);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(initialForm);
    setBannerFile(null);
    setBannerPreview("");
    setValidationError("");
  }, [open]);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  const submitError = validationError || error || "";

  const discountInputAffix = useMemo(() => {
    if (form.discountType === "fixed") {
      return {
        prefix: "Rp",
        suffix: "",
      };
    }
    return {
      prefix: "",
      suffix: "%",
    };
  }, [form.discountType]);

  const setField = (patch) => {
    setValidationError("");
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const campaignName = form.campaignName.trim();
    const code = form.code.trim().toUpperCase();
    const amount = toNumber(form.amount);
    const minSpend = toNumber(form.minSpend);
    const hasStartDate = Boolean(form.startDate);
    const hasEndDate = Boolean(form.endDate);

    if (!campaignName) {
      setValidationError("Campaign Name is required.");
      return;
    }
    if (!code) {
      setValidationError("Campaign Code is required.");
      return;
    }
    if (form.discountType === "percent" && (amount < 0 || amount > 100)) {
      setValidationError("Percent discount must be between 0 and 100.");
      return;
    }
    if (form.discountType === "fixed" && amount < 0) {
      setValidationError("Discount must be greater than or equal to 0.");
      return;
    }
    if (amount <= 0) {
      setValidationError("Discount must be greater than 0.");
      return;
    }
    if (minSpend < 0) {
      setValidationError("Minimum Amount must be greater than or equal to 0.");
      return;
    }
    if (hasStartDate && hasEndDate && new Date(form.endDate) < new Date(form.startDate)) {
      setValidationError("End Date must be greater than or equal to Start Date.");
      return;
    }

    onSubmit({
      campaignName,
      code,
      startDate: hasStartDate ? form.startDate : null,
      discountType: form.discountType,
      amount,
      minSpend,
      active: Boolean(form.active),
      expiresAt: hasEndDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : null,
      bannerName: bannerFile?.name || null,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/45"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Close add coupon drawer"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[620px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">
                Admin / Coupons / Add
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Add Coupon
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Create campaign codes, discount setup, and validity period.
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
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Basic Info</h3>
              <p className="mt-1 text-xs text-slate-500">
                Configure campaign identity used in checkout.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Language
                  </label>
                  <select
                    value={form.language}
                    onChange={(event) => setField({ language: event.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="en">English</option>
                    <option value="id">Bahasa Indonesia</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Campaign Code
                  </label>
                  <input
                    value={form.code}
                    onChange={(event) =>
                      setField({ code: event.target.value.toUpperCase().replace(/\s+/g, "") })
                    }
                    placeholder="WEEKEND25"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm uppercase text-slate-700 focus:border-emerald-500 focus:outline-none"
                    disabled={isSubmitting}
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Campaign Name
                  </label>
                  <input
                    value={form.campaignName}
                    onChange={(event) => setField({ campaignName: event.target.value })}
                    placeholder="Weekend Grocery Sale"
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                    disabled={isSubmitting}
                    required
                  />
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Discount</h3>
              <p className="mt-1 text-xs text-slate-500">
                Set discount type, value, and minimum order amount.
              </p>
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Discount Type
                  </label>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      onClick={() => setField({ discountType: "percent" })}
                      className={`h-10 rounded-lg text-sm font-semibold transition ${
                        form.discountType === "percent"
                          ? "bg-white text-emerald-700 shadow-sm"
                          : "text-slate-600 hover:text-slate-800"
                      }`}
                      disabled={isSubmitting}
                    >
                      Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setField({ discountType: "fixed" })}
                      className={`h-10 rounded-lg text-sm font-semibold transition ${
                        form.discountType === "fixed"
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
                        min={form.discountType === "percent" ? 0 : 0}
                        max={form.discountType === "percent" ? 100 : undefined}
                        step="1"
                        value={form.amount}
                        onChange={(event) => setField({ amount: event.target.value })}
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
                        value={form.minSpend}
                        onChange={(event) => setField({ minSpend: event.target.value })}
                        className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Validity</h3>
              <p className="mt-1 text-xs text-slate-500">
                Define coupon active period and publish status.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setField({ startDate: event.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                    disabled={isSubmitting}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setField({ endDate: event.target.value })}
                    className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Published</p>
                    <p className="text-xs text-slate-500">Enable coupon for checkout immediately</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setField({ active: !form.active })}
                    disabled={isSubmitting}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                      form.active ? "bg-emerald-500" : "bg-slate-300"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                    aria-label="Toggle published"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        form.active ? "translate-x-5" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Banner Image</h3>
              <p className="mt-1 text-xs text-slate-500">
                Upload campaign banner for promotional presentation.
              </p>
              <div className="mt-4">
                <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isSubmitting}
                  />
                  {bannerPreview ? (
                    <div className="space-y-3">
                      <img
                        src={bannerPreview}
                        alt="Coupon banner preview"
                        className="h-28 w-full rounded-xl object-cover"
                      />
                      <p className="text-xs text-slate-500">{bannerFile?.name}</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-medium">Upload banner image (UI only)</p>
                        <p className="text-xs text-slate-500">PNG/JPG, local preview only</p>
                      </div>
                      <UploadCloud className="ml-auto h-5 w-5 text-slate-400" />
                    </div>
                  )}
                </label>
              </div>
            </section>

            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError || GENERIC_ERROR}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:border-slate-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? "Adding..." : "Add Coupon"}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
