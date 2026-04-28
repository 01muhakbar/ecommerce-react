import { useEffect, useMemo, useState } from "react";
import { ImagePlus, UploadCloud, X } from "lucide-react";
import { uploadAdminImage } from "../../../lib/adminApi.js";
import { resolveAssetUrl } from "../../../lib/assetUrl.js";
import { GENERIC_ERROR } from "../../../constants/uiMessages.js";

const initialForm = {
  language: "en",
  campaignName: "",
  code: "",
  scopeType: "PLATFORM",
  storeId: "",
  startDate: "",
  endDate: "",
  discountType: "percent",
  amount: "",
  minSpend: "",
  active: true,
  bannerImageUrl: "",
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

const sectionCardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";

function CouponDrawerSectionHeader({ eyebrow, title, description, meta }) {
  return (
    <div className="mb-3 flex flex-col gap-2 border-b border-slate-100 pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
          {eyebrow}
        </p>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      {meta ? (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
          {meta}
        </span>
      ) : null}
    </div>
  );
}

export default function AddCouponDrawer({
  open,
  onClose,
  onSubmit,
  isSubmitting,
  error,
  storeOptions = [],
}) {
  const [form, setForm] = useState(initialForm);
  const [bannerFileName, setBannerFileName] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState("");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    revokeObjectUrl(bannerPreview);
    setForm(initialForm);
    setBannerFileName("");
    setBannerPreview("");
    setBannerUploading(false);
    setBannerUploadError("");
    setValidationError("");
  }, [open]);

  useEffect(() => {
    return () => {
      revokeObjectUrl(bannerPreview);
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

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    revokeObjectUrl(bannerPreview);
    const localPreviewUrl = URL.createObjectURL(file);
    setValidationError("");
    setBannerUploadError("");
    setBannerFileName(file.name);
    setBannerPreview(localPreviewUrl);
    setField({ bannerImageUrl: "" });
    setBannerUploading(true);
    try {
      const uploaded = await uploadAdminImage(file);
      const uploadedUrl = String(uploaded?.url || "").trim();
      if (!uploadedUrl) {
        throw new Error("Upload response did not include an image URL.");
      }
      revokeObjectUrl(localPreviewUrl);
      setBannerPreview("");
      setField({ bannerImageUrl: uploadedUrl });
    } catch (uploadError) {
      setBannerUploadError(
        uploadError?.response?.data?.message ||
          uploadError?.message ||
          "Failed to upload banner image."
      );
    } finally {
      setBannerUploading(false);
      event.target.value = "";
    }
  };

  const handleRemoveBanner = () => {
    revokeObjectUrl(bannerPreview);
    setBannerFileName("");
    setBannerPreview("");
    setBannerUploadError("");
    setField({ bannerImageUrl: "" });
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
    if (bannerUploading) {
      setValidationError("Wait for the banner image upload to finish before saving.");
      return;
    }
    if (bannerPreview && !form.bannerImageUrl) {
      setValidationError("Banner upload failed. Re-upload the image before saving this coupon.");
      return;
    }
    if (!code) {
      setValidationError("Campaign Code is required.");
      return;
    }
    if (form.scopeType === "STORE" && !form.storeId) {
      setValidationError("Store is required for store-scoped coupons.");
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
      scopeType: form.scopeType,
      storeId: form.scopeType === "STORE" ? Number(form.storeId) : null,
      startDate: hasStartDate ? form.startDate : null,
      startsAt: hasStartDate ? new Date(`${form.startDate}T00:00:00`).toISOString() : null,
      discountType: form.discountType,
      amount,
      minSpend,
      active: Boolean(form.active),
      expiresAt: hasEndDate ? new Date(`${form.endDate}T23:59:59`).toISOString() : null,
      bannerImageUrl: form.bannerImageUrl || null,
    });
  };

  if (!open) return null;

  const bannerPreviewSrc = bannerPreview || resolveAssetUrl(form.bannerImageUrl);

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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                  Create Mode
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                  {form.discountType === "percent" ? "Percent discount" : "Fixed discount"}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">
                  {form.active ? "Publish on save" : "Save inactive"}
                </span>
              </div>
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
              <CouponDrawerSectionHeader
                eyebrow="Basic Info"
                title="Define campaign identity first"
                description="Set the code, scope, and campaign label that admin will recognize during checkout reviews."
                meta={form.code ? `${form.scopeType} / ${form.code}` : `${form.scopeType} / Code pending`}
              />
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
                    Scope
                  </label>
                  <select
                    value={form.scopeType}
                    onChange={(event) =>
                      setField({
                        scopeType: event.target.value,
                        storeId: event.target.value === "STORE" ? form.storeId : "",
                      })
                    }
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                    disabled={isSubmitting}
                  >
                    <option value="PLATFORM">Platform / Global</option>
                    <option value="STORE">Store-scoped</option>
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
                {form.scopeType === "STORE" ? (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Linked Store
                    </label>
                    <select
                      value={form.storeId}
                      onChange={(event) => setField({ storeId: event.target.value })}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:border-emerald-500 focus:outline-none"
                      disabled={isSubmitting}
                      required
                    >
                      <option value="">Select store</option>
                      {storeOptions.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                          {store.slug ? ` (${store.slug})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
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
              <CouponDrawerSectionHeader
                eyebrow="Discount Setup"
                title="Group discount value with order threshold"
                description="Keep discount type, amount, and minimum order together so the promotion rule stays easy to review."
                meta={form.discountType === "percent" ? "Percent mode" : "Fixed mode"}
              />
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
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  {form.discountType === "percent"
                    ? "Use percentage campaigns for broad promotions, then set a minimum amount if the coupon should only apply to larger carts."
                    : "Use fixed discounts for nominal promos and confirm the minimum order so the campaign stays profitable."}
                </div>
              </div>
            </section>

            <section className={sectionCardClass}>
              <CouponDrawerSectionHeader
                eyebrow="Validity"
                title="Confirm active window and storefront visibility"
                description="Review the campaign schedule and decide whether checkout should see it immediately after save."
                meta={form.endDate ? `Ends ${form.endDate}` : "No expiry yet"}
              />
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
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
                  {form.startDate ? `Starts ${form.startDate}` : "Start date optional"}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
                  {form.scopeType === "STORE" ? "Seller-owned / admin-governed" : "Admin-owned global"}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
                  {form.endDate ? `Ends ${form.endDate}` : "End date optional"}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1">
                  {form.active ? "Visible after save" : "Hidden after save"}
                </span>
              </div>
            </section>

            <section className={sectionCardClass}>
              <h3 className="text-base font-semibold text-slate-900">Banner Image</h3>
              <p className="mt-1 text-xs text-slate-500">
                Upload a campaign banner and save its shared media URL to this coupon.
              </p>
              <div className="mt-4">
                <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-emerald-400 hover:bg-emerald-50/40">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isSubmitting || bannerUploading}
                  />
                  {bannerPreviewSrc ? (
                    <div className="space-y-3">
                      <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100/80 aspect-[16/5] sm:aspect-[16/4]">
                        <img
                          src={bannerPreviewSrc}
                          alt="Coupon banner preview"
                          className="absolute inset-0 h-full w-full object-contain"
                        />
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-600">
                            {bannerFileName || "Uploaded coupon banner"}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {bannerUploading
                              ? "Uploading banner image..."
                              : form.bannerImageUrl
                                ? "Banner uploaded and ready to save."
                                : "Upload did not finish. Select the image again before saving."}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleRemoveBanner();
                          }}
                          className="inline-flex h-8 items-center justify-center rounded-full border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-slate-300 hover:bg-white"
                          disabled={isSubmitting || bannerUploading}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-sm text-slate-600">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <ImagePlus className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="font-medium">
                          {bannerUploading ? "Uploading banner image..." : "Upload banner image"}
                        </p>
                        <p className="text-xs text-slate-500">
                          PNG/JPG/WebP, stored in shared admin uploads.
                        </p>
                      </div>
                      <UploadCloud className="ml-auto h-5 w-5 text-slate-400" />
                    </div>
                  )}
                </label>
              </div>
              {bannerUploadError ? (
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {bannerUploadError}
                </div>
              ) : null}
            </section>

            {submitError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {submitError || GENERIC_ERROR}
              </div>
            ) : null}
          </div>

          <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-xs text-slate-500">
                <p className="font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Coupon Action Panel
                </p>
                <p>
                  {form.code
                    ? `${form.code} will be saved as a ${form.discountType === "percent" ? "percentage" : "fixed"} campaign.`
                    : "Review campaign code, discount rule, and validity before saving this coupon."}
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:min-w-[280px]">
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
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
