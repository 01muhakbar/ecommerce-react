import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminSettings,
  fetchAdminStoreSettings,
  updateAdminSettings,
  updateAdminStoreSettings,
  uploadAdminBrandingLogo,
} from "../lib/adminApi.js";
import { resolveAssetUrl } from "../lib/assetUrl.js";
import {
  getWorkspaceLogoUrl,
  hasCustomBrandingLogo,
} from "../lib/branding.js";

const DEFAULT_SETTINGS = {
  imagesPerProduct: "12",
  allowAutoTranslation: "false",
  defaultLanguage: "English",
  defaultCurrency: "IDR",
  defaultTimeZone: "Asia/Makassar",
  defaultDateFormat: "D MMM, YYYY",
  receiptWidth: "57 mm",
  invoiceEmailEnabled: "true",
  invoiceFromEmail: "sales@kachabazar.com",
  companyFromName: "KachaBazar",
  companyName: "HtmlLover ltd",
  vatNumber: "47589",
  companyAddress: "59 Station Rd, Purls Bridge, United Kingdom",
  postCode: "2030",
  contactPhone: "019579034",
  contactEmail: "kachabazar@gmail.com",
  website: "kachabazar-admin.vercel.app",
};

const DEFAULT_BRANDING_SETTINGS = {
  clientLogoUrl: "",
  adminLogoUrl: "",
  sellerLogoUrl: "",
  workspaceBrandName: "TP PRENEURS",
};

const BRANDING_MAX_FILE_BYTES = 1024 * 1024;
const BRANDING_ACCEPT = "image/png,image/jpeg,image/webp";
const BRANDING_ITEMS = [
  {
    key: "client",
    field: "clientLogoUrl",
    label: "Client Logo",
    helper: "Digunakan di storefront.",
    previewClass: "aspect-[3.4/1] rounded-2xl",
  },
  {
    key: "admin",
    field: "adminLogoUrl",
    label: "Admin Logo",
    helper: "Digunakan di Admin Workspace.",
    previewClass: "aspect-square rounded-2xl",
  },
  {
    key: "seller",
    field: "sellerLogoUrl",
    label: "Seller Logo",
    helper: "Digunakan di Seller Workspace.",
    previewClass: "aspect-square rounded-2xl",
  },
];

const LANGUAGE_OPTIONS = ["English", "Indonesian", "Arabic", "French"];
const CURRENCY_OPTIONS = ["IDR", "USD", "EUR", "GBP"];
const TIME_ZONE_OPTIONS = [
  { value: "Asia/Makassar", label: "Asia/Makassar (UTC+08:00 WITA)" },
  { value: "Asia/Jakarta", label: "Asia/Jakarta (UTC+07:00 WIB)" },
  { value: "Asia/Jayapura", label: "Asia/Jayapura (UTC+09:00 WIT)" },
  { value: "UTC", label: "UTC (UTC+00:00)" },
];
const DATE_FORMAT_OPTIONS = [
  "D MMM, YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
  "MMM D, YYYY",
];
const RECEIPT_WIDTH_OPTIONS = ["57 mm", "80 mm"];

const toStringValue = (value, fallback = "") => {
  if (value === undefined || value === null) return fallback;
  return String(value);
};

const normalizeBooleanString = (value, fallback = "false") => {
  if (value === "true" || value === true) return "true";
  if (value === "false" || value === false) return "false";
  return fallback;
};

const mapSettingsToForm = (settings) => {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  return {
    imagesPerProduct: toStringValue(
      merged.imagesPerProduct,
      DEFAULT_SETTINGS.imagesPerProduct
    ),
    allowAutoTranslation: normalizeBooleanString(
      merged.allowAutoTranslation,
      DEFAULT_SETTINGS.allowAutoTranslation
    ),
    defaultLanguage: toStringValue(
      merged.defaultLanguage,
      DEFAULT_SETTINGS.defaultLanguage
    ),
    defaultCurrency: toStringValue(
      merged.defaultCurrency,
      DEFAULT_SETTINGS.defaultCurrency
    ),
    defaultTimeZone: toStringValue(
      merged.defaultTimeZone,
      DEFAULT_SETTINGS.defaultTimeZone
    ),
    defaultDateFormat: toStringValue(
      merged.defaultDateFormat,
      DEFAULT_SETTINGS.defaultDateFormat
    ),
    receiptWidth: toStringValue(merged.receiptWidth, DEFAULT_SETTINGS.receiptWidth),
    invoiceEmailEnabled: normalizeBooleanString(
      merged.invoiceEmailEnabled,
      DEFAULT_SETTINGS.invoiceEmailEnabled
    ),
    invoiceFromEmail: toStringValue(
      merged.invoiceFromEmail,
      DEFAULT_SETTINGS.invoiceFromEmail
    ),
    companyFromName: toStringValue(
      merged.companyFromName,
      DEFAULT_SETTINGS.companyFromName
    ),
    companyName: toStringValue(merged.companyName, DEFAULT_SETTINGS.companyName),
    vatNumber: toStringValue(merged.vatNumber, DEFAULT_SETTINGS.vatNumber),
    companyAddress: toStringValue(
      merged.companyAddress,
      DEFAULT_SETTINGS.companyAddress
    ),
    postCode: toStringValue(merged.postCode, DEFAULT_SETTINGS.postCode),
    contactPhone: toStringValue(
      merged.contactPhone,
      DEFAULT_SETTINGS.contactPhone
    ),
    contactEmail: toStringValue(
      merged.contactEmail,
      DEFAULT_SETTINGS.contactEmail
    ),
    website: toStringValue(merged.website, DEFAULT_SETTINGS.website),
  };
};

const normalizeBrandingSettings = (settings) => {
  const branding = settings?.storeSettings?.branding || settings?.branding || {};
  return {
    clientLogoUrl: toStringValue(branding.clientLogoUrl),
    adminLogoUrl: toStringValue(branding.adminLogoUrl),
    sellerLogoUrl: toStringValue(branding.sellerLogoUrl),
    workspaceBrandName: toStringValue(
      branding.workspaceBrandName,
      DEFAULT_BRANDING_SETTINGS.workspaceBrandName
    ),
  };
};

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const textareaClass =
  "mt-2 min-h-[120px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function ToggleField({ label, value, onChange }) {
  const activeYes = value === "true";
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3.5">
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5">
        <button
          type="button"
          onClick={() => onChange("true")}
          className={`h-9 rounded-lg border px-4 text-sm font-semibold transition ${
            activeYes
              ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange("false")}
          className={`h-9 rounded-lg border px-4 text-sm font-semibold transition ${
            activeYes
              ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              : "border-emerald-600 bg-emerald-600 text-white shadow-sm"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section
      id={id}
      className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6"
    >
      <h2 className="text-[17px] font-semibold text-slate-800">{title}</h2>
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function BrandingCard({
  item,
  logoUrl,
  isUploading,
  onFileChange,
}) {
  const hasCustomLogo = hasCustomBrandingLogo(logoUrl);
  const previewSrc =
    item.key === "client"
      ? resolveAssetUrl(logoUrl)
      : getWorkspaceLogoUrl(item.key, logoUrl);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{item.helper}</p>
        </div>

        <div
          className={`flex items-center justify-center overflow-hidden border border-slate-200 bg-white p-3 ${item.previewClass}`}
        >
          {previewSrc ? (
            <img
              src={previewSrc}
              alt={`${item.label} preview`}
              className="h-full w-full object-contain"
            />
          ) : (
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Fallback
            </span>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            {hasCustomLogo ? "Current source: custom upload" : "Current source: fallback"}
          </p>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-emerald-200 bg-white px-4 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50">
            <input
              type="file"
              accept={BRANDING_ACCEPT}
              className="sr-only"
              disabled={isUploading}
              onChange={(event) => onFileChange(item, event)}
            />
            {isUploading ? "Uploading..." : hasCustomLogo ? "Replace Logo" : "Upload Logo"}
          </label>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => mapSettingsToForm());
  const [feedback, setFeedback] = useState(null);
  const [brandingFeedback, setBrandingFeedback] = useState(null);
  const [activeBrandingTarget, setActiveBrandingTarget] = useState("");
  const [brandingForm, setBrandingForm] = useState(() => DEFAULT_BRANDING_SETTINGS);

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchAdminSettings,
  });

  const brandingSettingsQuery = useQuery({
    queryKey: ["admin-store-settings", "branding"],
    queryFn: fetchAdminStoreSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(mapSettingsToForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

  useEffect(() => {
    if (!brandingSettingsQuery.data) return;
    setBrandingForm(normalizeBrandingSettings(brandingSettingsQuery.data));
  }, [brandingSettingsQuery.data]);

  const mutation = useMutation({
    mutationFn: updateAdminSettings,
    onSuccess: (data) => {
      setForm(mapSettingsToForm(data));
      setFeedback({
        type: "success",
        message: "Settings updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update settings.";
      setFeedback({ type: "error", message });
    },
  });

  const brandingUploadMutation = useMutation({
    mutationFn: ({ target, file }) => uploadAdminBrandingLogo(target, file),
  });

  const brandingMutation = useMutation({
    mutationFn: (payload) => updateAdminStoreSettings(payload),
    onSuccess: (data) => {
      const nextBranding = normalizeBrandingSettings(data);
      setBrandingForm(nextBranding);
      setBrandingFeedback({
        type: "success",
        message: "Workspace brand text updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-store-settings"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["store-settings", "public"], exact: false });
      queryClient.invalidateQueries({
        queryKey: ["store-settings", "public", "branding"],
        exact: false,
      });
    },
    onError: (error) => {
      setBrandingFeedback({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          "Failed to update workspace brand text.",
      });
    },
  });

  const isSaving = mutation.isPending;
  const isSavingBrandingText = brandingMutation.isPending;

  const statusBoxClass = useMemo(() => {
    if (!feedback) return "";
    return feedback.type === "success"
      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700";
  }, [feedback]);

  const brandingStatusBoxClass = useMemo(() => {
    if (!brandingFeedback) return "";
    return brandingFeedback.type === "success"
      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700";
  }, [brandingFeedback]);

  const branding = useMemo(
    () => normalizeBrandingSettings(brandingSettingsQuery.data),
    [brandingSettingsQuery.data]
  );

  const onInputChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setFeedback(null);
    mutation.mutate({
      ...form,
      allowAutoTranslation: normalizeBooleanString(
        form.allowAutoTranslation,
        "false"
      ),
      invoiceEmailEnabled: normalizeBooleanString(
        form.invoiceEmailEnabled,
        "true"
      ),
    });
  };

  const handleBrandingFileChange = async (item, event) => {
    const input = event.target;
    const file = input?.files?.[0];
    input.value = "";

    if (!file) return;

    setBrandingFeedback(null);

    if (!String(file.type || "").startsWith("image/")) {
      setBrandingFeedback({
        type: "error",
        message: `${item.label} must be an image file.`,
      });
      return;
    }

    if (Number(file.size || 0) > BRANDING_MAX_FILE_BYTES) {
      setBrandingFeedback({
        type: "error",
        message: `${item.label} must be 1MB or smaller.`,
      });
      return;
    }

    try {
      setActiveBrandingTarget(item.key);
      await brandingUploadMutation.mutateAsync({ target: item.key, file });
      setBrandingFeedback({
        type: "success",
        message: `${item.label} updated successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ["admin-store-settings"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["store-settings", "public"], exact: false });
      queryClient.invalidateQueries({
        queryKey: ["store-settings", "public", "branding"],
        exact: false,
      });
    } catch (error) {
      setBrandingFeedback({
        type: "error",
        message:
          error?.response?.data?.message ||
          error?.message ||
          `Failed to upload ${item.label.toLowerCase()}.`,
      });
    } finally {
      setActiveBrandingTarget("");
    }
  };

  const handleBrandingTextSubmit = (event) => {
    event.preventDefault();
    setBrandingFeedback(null);
    brandingMutation.mutate({
      storeSettings: {
        branding: {
          workspaceBrandName: String(
            brandingForm.workspaceBrandName || DEFAULT_BRANDING_SETTINGS.workspaceBrandName
          ).trim(),
        },
      },
    });
  };

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1120px] px-1 sm:px-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          Loading...
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    const message =
      settingsQuery.error?.response?.data?.message ||
      settingsQuery.error?.message ||
      "Failed to load settings.";
    return (
      <div className="mx-auto w-full max-w-[1120px] px-1 sm:px-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <p className="text-sm text-rose-700">{message}</p>
          <button
            type="button"
            onClick={() => settingsQuery.refetch()}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (brandingSettingsQuery.isError) {
    const message =
      brandingSettingsQuery.error?.response?.data?.message ||
      brandingSettingsQuery.error?.message ||
      "Failed to load branding settings.";
    return (
      <div className="mx-auto w-full max-w-[1120px] px-1 sm:px-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
          <p className="text-sm text-rose-700">{message}</p>
          <button
            type="button"
            onClick={() => brandingSettingsQuery.refetch()}
            className="mt-4 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-1 sm:px-2">
      <form className="space-y-5 pb-2" onSubmit={onSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-6 sm:py-5">
          <h1 className="text-[22px] font-semibold leading-none text-slate-800">
            Global Setting
          </h1>
          <button
            type="submit"
            disabled={isSaving}
            className="h-10 min-w-[110px] rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Updating..." : "Update"}
          </button>
        </div>

        {feedback ? <div className={statusBoxClass}>{feedback.message}</div> : null}

        <Section id="branding-settings" title="Branding Settings">
          <div className="lg:col-span-2">
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="min-w-0 flex-1">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">
                      Workspace Brand Text
                    </span>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Teks ini dipakai untuk judul brand di sidebar Admin dan Seller.
                    </p>
                    <input
                      type="text"
                      value={brandingForm.workspaceBrandName}
                      onChange={(event) =>
                        setBrandingForm((prev) => ({
                          ...prev,
                          workspaceBrandName: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder="TP PRENEURS"
                      maxLength={60}
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleBrandingTextSubmit}
                  disabled={isSavingBrandingText}
                  className="h-10 min-w-[170px] rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingBrandingText ? "Updating..." : "Update Brand Text"}
                </button>
              </div>
            </div>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Uploads here replace the current branding source immediately for Client, Admin, and
              Seller shells. Admin and Seller logos render inside a square frame automatically.
            </div>
            {brandingFeedback ? (
              <div className={`${brandingStatusBoxClass} mb-4`}>{brandingFeedback.message}</div>
            ) : null}
            {brandingSettingsQuery.isLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                Loading branding settings...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {BRANDING_ITEMS.map((item) => (
                  <BrandingCard
                    key={item.key}
                    item={item}
                    logoUrl={branding[item.field]}
                    isUploading={activeBrandingTarget === item.key}
                    onFileChange={handleBrandingFileChange}
                  />
                ))}
              </div>
            )}
          </div>
        </Section>

        <Section id="general-settings" title="General Settings">
          <Field label="Number of images per product">
            <input
              type="number"
              min="1"
              className={inputClass}
              value={form.imagesPerProduct}
              onChange={(event) =>
                onInputChange("imagesPerProduct", event.target.value)
              }
            />
          </Field>

          <Field label="Default language">
            <select
              className={inputClass}
              value={form.defaultLanguage}
              onChange={(event) => onInputChange("defaultLanguage", event.target.value)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <ToggleField
            label="Allow Auto Translation"
            value={form.allowAutoTranslation}
            onChange={(value) => onInputChange("allowAutoTranslation", value)}
          />

          <Field label="Default currency">
            <select
              className={inputClass}
              value={form.defaultCurrency}
              onChange={(event) => onInputChange("defaultCurrency", event.target.value)}
            >
              {CURRENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default time zone">
            <select
              className={inputClass}
              value={form.defaultTimeZone}
              onChange={(event) => onInputChange("defaultTimeZone", event.target.value)}
            >
              {TIME_ZONE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Default Date Format">
            <select
              className={inputClass}
              value={form.defaultDateFormat}
              onChange={(event) => onInputChange("defaultDateFormat", event.target.value)}
            >
              {DATE_FORMAT_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Receipt size (width)">
            <select
              className={inputClass}
              value={form.receiptWidth}
              onChange={(event) => onInputChange("receiptWidth", event.target.value)}
            >
              {RECEIPT_WIDTH_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
        </Section>

        <Section id="invoice-settings" title="Invoice Settings">
          <ToggleField
            label="Enable invoice send to customer by email"
            value={form.invoiceEmailEnabled}
            onChange={(value) => onInputChange("invoiceEmailEnabled", value)}
          />
          <Field label="From Email">
            <input
              type="email"
              className={inputClass}
              value={form.invoiceFromEmail}
              onChange={(event) => onInputChange("invoiceFromEmail", event.target.value)}
            />
          </Field>
        </Section>

        <Section id="company-information" title="Company Information">
          <Field label="From Email">
            <input
              type="text"
              className={inputClass}
              value={form.companyFromName}
              onChange={(event) => onInputChange("companyFromName", event.target.value)}
            />
          </Field>
          <Field label="Company Name">
            <input
              type="text"
              className={inputClass}
              value={form.companyName}
              onChange={(event) => onInputChange("companyName", event.target.value)}
            />
          </Field>
          <Field label="Vat Number">
            <input
              type="text"
              className={inputClass}
              value={form.vatNumber}
              onChange={(event) => onInputChange("vatNumber", event.target.value)}
            />
          </Field>
          <Field label="Post Code">
            <input
              type="text"
              className={inputClass}
              value={form.postCode}
              onChange={(event) => onInputChange("postCode", event.target.value)}
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Address">
              <textarea
                rows="4"
                className={textareaClass}
                value={form.companyAddress}
                onChange={(event) => onInputChange("companyAddress", event.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section id="contact-information" title="Contact Information">
          <Field label="Contact">
            <input
              type="text"
              className={inputClass}
              value={form.contactPhone}
              onChange={(event) => onInputChange("contactPhone", event.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className={inputClass}
              value={form.contactEmail}
              onChange={(event) => onInputChange("contactEmail", event.target.value)}
            />
          </Field>
          <div className="lg:col-span-2">
            <Field label="Web site">
              <input
                type="text"
                className={inputClass}
                value={form.website}
                onChange={(event) => onInputChange("website", event.target.value)}
              />
            </Field>
          </div>
        </Section>
      </form>
    </div>
  );
}
