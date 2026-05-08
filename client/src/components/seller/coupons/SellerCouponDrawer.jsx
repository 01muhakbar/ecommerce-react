import { useEffect, useMemo, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";
import { uploadSellerCouponBannerImage } from "../../../api/sellerCoupons.ts";
import { resolveAssetUrl } from "../../../lib/assetUrl.js";
import { GENERIC_ERROR } from "../../../constants/uiMessages.js";

const initialForm = {
  campaignName: "",
  code: "",
  discountType: "fixed",
  amount: "",
  minSpend: "",
  startsAt: "",
  expiresAt: "",
  active: true,
  bannerImageUrl: "",
};

const toDateInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const toNumber = (value) => {
  const numeric = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

const revokeObjectUrl = (value) => {
  if (typeof value === "string" && value.startsWith("blob:")) {
    URL.revokeObjectURL(value);
  }
};

const sectionTitleClass = "mb-4 flex items-center justify-between gap-3 border-b border-slate-100 pb-3";
const labelClass = "mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-500";
const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none";

const createFormState = (coupon, canManageStatus) => {
  if (!coupon) {
    return {
      ...initialForm,
      active: Boolean(canManageStatus),
    };
  }

  return {
    campaignName: String(coupon.campaignName || coupon.code || "").trim(),
    code: String(coupon.code || "").trim().toUpperCase(),
    discountType: coupon.discountType === "percent" ? "percent" : "fixed",
    amount: coupon.amount ? String(Number(coupon.amount)) : "",
    minSpend: coupon.minSpend ? String(Number(coupon.minSpend)) : "",
    startsAt: toDateInput(coupon.startsAt),
    expiresAt: toDateInput(coupon.expiresAt),
    active: typeof coupon.active === "boolean" ? coupon.active : Boolean(canManageStatus),
    bannerImageUrl: String(coupon.bannerImageUrl || "").trim(),
  };
};

export default function SellerCouponDrawer({
  open,
  onClose,
  onSubmit,
  coupon = null,
  isSubmitting = false,
  error = "",
  canManageStatus = true,
}) {
  const isEdit = Boolean(coupon?.id);
  const [form, setForm] = useState(() => createFormState(coupon, canManageStatus));
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerFileName, setBannerFileName] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    if (!open) return;
    revokeObjectUrl(bannerPreview);
    setForm(createFormState(coupon, canManageStatus));
    setBannerPreview("");
    setBannerFileName("");
    setBannerUploading(false);
    setBannerUploadError("");
    setValidationError("");
  }, [open, coupon, canManageStatus]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(bannerPreview);
    };
  }, [bannerPreview]);

  const bannerPreviewSrc = bannerPreview || resolveAssetUrl(form.bannerImageUrl);
  const submitError = validationError || bannerUploadError || error || "";
  const discountAffix = useMemo(
    () => (form.discountType === "fixed" ? { prefix: "Rp", suffix: "" } : { prefix: "", suffix: "%" }),
    [form.discountType]
  );

  const setField = (patch) => {
    setValidationError("");
    setForm((current) => ({ ...current, ...patch }));
  };

  const handleBannerChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    revokeObjectUrl(bannerPreview);
    const localPreview = URL.createObjectURL(file);
    setBannerPreview(localPreview);
    setBannerFileName(file.name);
    setBannerUploadError("");
    setValidationError("");
    setField({ bannerImageUrl: "" });
    setBannerUploading(true);
    try {
      const url = await uploadSellerCouponBannerImage(file);
      revokeObjectUrl(localPreview);
      setBannerPreview("");
      setField({ bannerImageUrl: url });
    } catch (uploadError) {
      setBannerUploadError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          "Failed to upload coupon banner."
      );
    } finally {
      setBannerUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveBanner = () => {
    revokeObjectUrl(bannerPreview);
    setBannerPreview("");
    setBannerFileName("");
    setBannerUploadError("");
    setField({ bannerImageUrl: "" });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const campaignName = String(form.campaignName || "").trim();
    const code = String(form.code || "").trim().toUpperCase().replace(/\s+/g, "");
    const amount = toNumber(form.amount);
    const minSpend = toNumber(form.minSpend);

    if (!campaignName) {
      setValidationError("Campaign Name is required.");
      return;
    }
    if (!code) {
      setValidationError("Campaign Code is required.");
      return;
    }
    if (bannerUploading) {
      setValidationError("Wait for the banner upload to finish before saving.");
      return;
    }
    if (bannerPreview && !form.bannerImageUrl) {
      setValidationError("Banner upload failed. Re-upload the image before saving.");
      return;
    }
    if (amount <= 0) {
      setValidationError("Discount must be greater than 0.");
      return;
    }
    if (form.discountType === "percent" && amount > 100) {
      setValidationError("Percentage discount must be between 1 and 100.");
      return;
    }
    if (minSpend < 0) {
      setValidationError("Minimum Amount must be greater than or equal to 0.");
      return;
    }
    if (form.startsAt && form.expiresAt) {
      const start = new Date(`${form.startsAt}T00:00:00`);
      const end = new Date(`${form.expiresAt}T23:59:59`);
      if (end < start) {
        setValidationError("Coupon Validity Time is invalid.");
        return;
      }
    }

    onSubmit({
      campaignName,
      code,
      discountType: form.discountType,
      amount,
      minSpend,
      active: canManageStatus ? Boolean(form.active) : true,
      bannerImageUrl: form.bannerImageUrl || null,
      startsAt: form.startsAt ? new Date(`${form.startsAt}T00:00:00`).toISOString() : null,
      expiresAt: form.expiresAt ? new Date(`${form.expiresAt}T23:59:59`).toISOString() : null,
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => !isSubmitting && onClose()}
        aria-label="Close seller coupon drawer"
      />

      <aside className="absolute right-0 top-0 flex h-full w-full max-w-[720px] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <header className="border-b border-slate-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[30px] font-semibold tracking-tight text-slate-900">
                {isEdit ? "Edit Coupon" : "Add Coupon"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add your coupon and necessary information from here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => !isSubmitting && onClose()}
              disabled={isSubmitting}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <section>
              <div className={sectionTitleClass}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Coupon Banner Image</p>
                  <p className="text-xs text-slate-500">PNG/JPG upload stored in shared media.</p>
                </div>
              </div>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 transition hover:border-emerald-400 hover:bg-emerald-50/40">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleBannerChange}
                  disabled={isSubmitting || bannerUploading}
                />
                {bannerPreviewSrc ? (
                  <div className="space-y-3">
                    <div className="relative aspect-[16/5] overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img
                        src={bannerPreviewSrc}
                        alt="Coupon banner preview"
                        className="absolute inset-0 h-full w-full object-contain"
                      />
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {bannerFileName || "Coupon banner"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {bannerUploading
                            ? "Uploading banner image..."
                            : form.bannerImageUrl
                              ? "Banner uploaded and ready to save."
                              : "Upload did not finish. Re-upload the image before saving."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          handleRemoveBanner();
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:bg-white"
                        disabled={isSubmitting || bannerUploading}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex min-h-[150px] flex-col items-center justify-center gap-3 text-center text-slate-500">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      {bannerUploading ? <UploadCloud className="h-6 w-6" /> : <ImagePlus className="h-6 w-6" />}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">
                        {bannerUploading ? "Uploading banner image..." : "Drag your image here"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Only `.jpeg` and `.png` images will be accepted.
                      </p>
                    </div>
                  </div>
                )}
              </label>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className={labelClass}>Campaign Name</span>
                <input
                  value={form.campaignName}
                  onChange={(event) => setField({ campaignName: event.target.value })}
                  placeholder="Campaign Name"
                  className={inputClass}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <label className="block">
                <span className={labelClass}>Campaign Code</span>
                <input
                  value={form.code}
                  onChange={(event) =>
                    setField({ code: event.target.value.toUpperCase().replace(/\s+/g, "") })
                  }
                  placeholder="Campaign Code"
                  className={`${inputClass} uppercase`}
                  disabled={isSubmitting}
                  required
                />
              </label>

              <div className="block">
                <span className={labelClass}>Coupon Validity Time</span>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    value={form.startsAt}
                    onChange={(event) => setField({ startsAt: event.target.value })}
                    className={inputClass}
                    disabled={isSubmitting}
                  />
                  <input
                    type="date"
                    value={form.expiresAt}
                    onChange={(event) => setField({ expiresAt: event.target.value })}
                    className={inputClass}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="block">
                <span className={labelClass}>Discount Type</span>
                <div className="grid grid-cols-2 gap-2 rounded-full border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setField({ discountType: "fixed" })}
                    className={`h-11 rounded-full text-sm font-semibold transition ${
                      form.discountType === "fixed"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                    disabled={isSubmitting}
                  >
                    Fixed
                  </button>
                  <button
                    type="button"
                    onClick={() => setField({ discountType: "percent" })}
                    className={`h-11 rounded-full text-sm font-semibold transition ${
                      form.discountType === "percent"
                        ? "bg-rose-500 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                    disabled={isSubmitting}
                  >
                    Percentage
                  </button>
                </div>
              </div>

              <label className="block">
                <span className={labelClass}>Discount</span>
                <div className="relative">
                  {discountAffix.prefix ? (
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                      {discountAffix.prefix}
                    </span>
                  ) : null}
                  <input
                    type="number"
                    min="0"
                    max={form.discountType === "percent" ? 100 : undefined}
                    step="1"
                    value={form.amount}
                    onChange={(event) => setField({ amount: event.target.value })}
                    className={`${inputClass} ${discountAffix.prefix ? "pl-11 pr-3" : "pl-3 pr-10"}`}
                    disabled={isSubmitting}
                    required
                  />
                  {discountAffix.suffix ? (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                      {discountAffix.suffix}
                    </span>
                  ) : null}
                </div>
              </label>

              <label className="block">
                <span className={labelClass}>Minimum Amount</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">
                    Rp
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={form.minSpend}
                    onChange={(event) => setField({ minSpend: event.target.value })}
                    className={`${inputClass} pl-11`}
                    disabled={isSubmitting}
                  />
                </div>
              </label>

              <div className="block md:col-span-2">
                <span className={labelClass}>Published</span>
                {canManageStatus ? (
                  <button
                    type="button"
                    onClick={() => setField({ active: !form.active })}
                    disabled={isSubmitting}
                    className={`inline-flex h-11 min-w-[116px] items-center justify-center rounded-full px-5 text-sm font-semibold transition ${
                      form.active ? "bg-rose-500 text-white" : "border border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {form.active ? "Yes" : "No"}
                  </button>
                ) : (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Published state follows your seller permission boundary and cannot be changed here.
                  </p>
                )}
              </div>
            </section>

            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError || GENERIC_ERROR}
              </div>
            ) : null}
          </div>

          <footer className="border-t border-slate-200 bg-white px-6 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? isEdit
                    ? "Saving..."
                    : "Adding..."
                  : isEdit
                    ? "Update Coupon"
                    : "Add Coupon"}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
