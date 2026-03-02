import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAdminSettings, updateAdminSettings } from "../lib/adminApi.js";

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

export default function Settings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => mapSettingsToForm());
  const [feedback, setFeedback] = useState(null);

  const settingsQuery = useQuery({
    queryKey: ["admin-settings"],
    queryFn: fetchAdminSettings,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setForm(mapSettingsToForm(settingsQuery.data));
    }
  }, [settingsQuery.data]);

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

  const isSaving = mutation.isPending;

  const statusBoxClass = useMemo(() => {
    if (!feedback) return "";
    return feedback.type === "success"
      ? "rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
      : "rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700";
  }, [feedback]);

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
