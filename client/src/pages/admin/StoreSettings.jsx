import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminStoreSettings,
  updateAdminStoreSettings,
} from "../../lib/adminApi.js";

const DEFAULT_STORE_SETTINGS = {
  payments: {
    cashOnDeliveryEnabled: true,
    stripeEnabled: true,
    stripeKey: "",
    stripeSecret: "",
    razorPayEnabled: false,
  },
  socialLogin: {
    googleEnabled: true,
    googleClientId: "",
    googleSecretKey: "",
    githubEnabled: true,
    githubId: "",
    githubSecret: "",
    facebookEnabled: true,
    facebookId: "",
    facebookSecret: "",
  },
  analytics: {
    googleAnalyticsEnabled: true,
    googleAnalyticKey: "",
  },
  chat: {
    tawkEnabled: true,
    tawkPropertyId: "",
    tawkWidgetId: "",
  },
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

const normalizeStoreSettings = (raw) => {
  const source = isPlainObject(raw) ? raw : {};
  const paymentsSource = isPlainObject(source.payments) ? source.payments : {};
  const socialSource = isPlainObject(source.socialLogin) ? source.socialLogin : {};
  const analyticsSource = isPlainObject(source.analytics) ? source.analytics : {};
  const chatSource = isPlainObject(source.chat) ? source.chat : {};

  return {
    payments: {
      cashOnDeliveryEnabled: toBool(
        paymentsSource.cashOnDeliveryEnabled,
        DEFAULT_STORE_SETTINGS.payments.cashOnDeliveryEnabled
      ),
      stripeEnabled: toBool(
        paymentsSource.stripeEnabled,
        DEFAULT_STORE_SETTINGS.payments.stripeEnabled
      ),
      stripeKey: toText(
        paymentsSource.stripeKey,
        DEFAULT_STORE_SETTINGS.payments.stripeKey
      ),
      stripeSecret: toText(
        paymentsSource.stripeSecret,
        DEFAULT_STORE_SETTINGS.payments.stripeSecret
      ),
      razorPayEnabled: toBool(
        paymentsSource.razorPayEnabled,
        DEFAULT_STORE_SETTINGS.payments.razorPayEnabled
      ),
    },
    socialLogin: {
      googleEnabled: toBool(
        socialSource.googleEnabled,
        DEFAULT_STORE_SETTINGS.socialLogin.googleEnabled
      ),
      googleClientId: toText(
        socialSource.googleClientId,
        DEFAULT_STORE_SETTINGS.socialLogin.googleClientId
      ),
      googleSecretKey: toText(
        socialSource.googleSecretKey,
        DEFAULT_STORE_SETTINGS.socialLogin.googleSecretKey
      ),
      githubEnabled: toBool(
        socialSource.githubEnabled,
        DEFAULT_STORE_SETTINGS.socialLogin.githubEnabled
      ),
      githubId: toText(socialSource.githubId, DEFAULT_STORE_SETTINGS.socialLogin.githubId),
      githubSecret: toText(
        socialSource.githubSecret,
        DEFAULT_STORE_SETTINGS.socialLogin.githubSecret
      ),
      facebookEnabled: toBool(
        socialSource.facebookEnabled,
        DEFAULT_STORE_SETTINGS.socialLogin.facebookEnabled
      ),
      facebookId: toText(
        socialSource.facebookId,
        DEFAULT_STORE_SETTINGS.socialLogin.facebookId
      ),
      facebookSecret: toText(
        socialSource.facebookSecret,
        DEFAULT_STORE_SETTINGS.socialLogin.facebookSecret
      ),
    },
    analytics: {
      googleAnalyticsEnabled: toBool(
        analyticsSource.googleAnalyticsEnabled,
        DEFAULT_STORE_SETTINGS.analytics.googleAnalyticsEnabled
      ),
      googleAnalyticKey: toText(
        analyticsSource.googleAnalyticKey,
        DEFAULT_STORE_SETTINGS.analytics.googleAnalyticKey
      ),
    },
    chat: {
      tawkEnabled: toBool(
        chatSource.tawkEnabled,
        DEFAULT_STORE_SETTINGS.chat.tawkEnabled
      ),
      tawkPropertyId: toText(
        chatSource.tawkPropertyId,
        DEFAULT_STORE_SETTINGS.chat.tawkPropertyId
      ),
      tawkWidgetId: toText(
        chatSource.tawkWidgetId,
        DEFAULT_STORE_SETTINGS.chat.tawkWidgetId
      ),
    },
  };
};

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleField({ label, value, onChange }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-3 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
            value ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`h-8 rounded-lg px-3 text-xs font-semibold transition ${
            !value ? "bg-emerald-600 text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          No
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6">
      <h2 className="text-[17px] font-semibold text-slate-800">{title}</h2>
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

export default function StoreSettingsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(() => normalizeStoreSettings(DEFAULT_STORE_SETTINGS));
  const [feedback, setFeedback] = useState(null);

  const settingsQuery = useQuery({
    queryKey: ["admin-store-settings"],
    queryFn: fetchAdminStoreSettings,
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    const normalized = normalizeStoreSettings(settingsQuery.data.storeSettings);
    setForm(normalized);
  }, [settingsQuery.data]);

  const mutation = useMutation({
    mutationFn: updateAdminStoreSettings,
    onSuccess: (data) => {
      const normalized = normalizeStoreSettings(data?.storeSettings);
      setForm(normalized);
      setFeedback({ type: "success", message: "Store settings updated successfully." });
      queryClient.invalidateQueries({ queryKey: ["admin-store-settings"] });
    },
    onError: (error) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to update store settings.";
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

  const setSectionField = (section, field, value) => {
    setForm((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setFeedback(null);
    mutation.mutate({ storeSettings: form });
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
      "Failed to load store settings.";
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
            Store Settings
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

        <Section title="Payment Methods">
          <ToggleField
            label="Cash On Delivery"
            value={form.payments.cashOnDeliveryEnabled}
            onChange={(value) => setSectionField("payments", "cashOnDeliveryEnabled", value)}
          />
          <div />
          <ToggleField
            label="Stripe Payment"
            value={form.payments.stripeEnabled}
            onChange={(value) => setSectionField("payments", "stripeEnabled", value)}
          />
          <div />
          <Field label="Stripe Key">
            <input
              type="text"
              value={form.payments.stripeKey}
              onChange={(event) => setSectionField("payments", "stripeKey", event.target.value)}
              className={inputClass}
              disabled={!form.payments.stripeEnabled}
            />
          </Field>
          <Field label="Stripe Secret">
            <input
              type="password"
              value={form.payments.stripeSecret}
              onChange={(event) =>
                setSectionField("payments", "stripeSecret", event.target.value)
              }
              className={inputClass}
              disabled={!form.payments.stripeEnabled}
            />
          </Field>
          <ToggleField
            label="RazorPay"
            value={form.payments.razorPayEnabled}
            onChange={(value) => setSectionField("payments", "razorPayEnabled", value)}
          />
        </Section>

        <Section title="Social Login">
          <ToggleField
            label="Google Login"
            value={form.socialLogin.googleEnabled}
            onChange={(value) => setSectionField("socialLogin", "googleEnabled", value)}
          />
          <div />
          <Field label="Google Client ID">
            <input
              type="text"
              value={form.socialLogin.googleClientId}
              onChange={(event) =>
                setSectionField("socialLogin", "googleClientId", event.target.value)
              }
              className={inputClass}
              disabled={!form.socialLogin.googleEnabled}
            />
          </Field>
          <Field label="Google Secret Key">
            <input
              type="password"
              value={form.socialLogin.googleSecretKey}
              onChange={(event) =>
                setSectionField("socialLogin", "googleSecretKey", event.target.value)
              }
              className={inputClass}
              disabled={!form.socialLogin.googleEnabled}
            />
          </Field>

          <ToggleField
            label="Github Login"
            value={form.socialLogin.githubEnabled}
            onChange={(value) => setSectionField("socialLogin", "githubEnabled", value)}
          />
          <div />
          <Field label="Github ID">
            <input
              type="text"
              value={form.socialLogin.githubId}
              onChange={(event) =>
                setSectionField("socialLogin", "githubId", event.target.value)
              }
              className={inputClass}
              disabled={!form.socialLogin.githubEnabled}
            />
          </Field>
          <Field label="Github Secret">
            <input
              type="password"
              value={form.socialLogin.githubSecret}
              onChange={(event) =>
                setSectionField("socialLogin", "githubSecret", event.target.value)
              }
              className={inputClass}
              disabled={!form.socialLogin.githubEnabled}
            />
          </Field>

          <ToggleField
            label="Facebook Login"
            value={form.socialLogin.facebookEnabled}
            onChange={(value) => setSectionField("socialLogin", "facebookEnabled", value)}
          />
          <div />
          <Field label="Facebook ID">
            <input
              type="text"
              value={form.socialLogin.facebookId}
              onChange={(event) =>
                setSectionField("socialLogin", "facebookId", event.target.value)
              }
              className={inputClass}
              disabled={!form.socialLogin.facebookEnabled}
            />
          </Field>
          <Field label="Facebook Secret">
            <input
              type="password"
              value={form.socialLogin.facebookSecret}
              onChange={(event) =>
                setSectionField("socialLogin", "facebookSecret", event.target.value)
              }
              className={inputClass}
              disabled={!form.socialLogin.facebookEnabled}
            />
          </Field>
        </Section>

        <Section title="Analytics & Chat">
          <ToggleField
            label="Google Analytics"
            value={form.analytics.googleAnalyticsEnabled}
            onChange={(value) =>
              setSectionField("analytics", "googleAnalyticsEnabled", value)
            }
          />
          <Field label="Google Analytic Key">
            <input
              type="text"
              value={form.analytics.googleAnalyticKey}
              onChange={(event) =>
                setSectionField("analytics", "googleAnalyticKey", event.target.value)
              }
              className={inputClass}
              disabled={!form.analytics.googleAnalyticsEnabled}
            />
          </Field>

          <ToggleField
            label="Tawk Chat"
            value={form.chat.tawkEnabled}
            onChange={(value) => setSectionField("chat", "tawkEnabled", value)}
          />
          <div />
          <Field label="Tawk Property ID">
            <input
              type="text"
              value={form.chat.tawkPropertyId}
              onChange={(event) => setSectionField("chat", "tawkPropertyId", event.target.value)}
              className={inputClass}
              disabled={!form.chat.tawkEnabled}
            />
          </Field>
          <Field label="Tawk Widget ID">
            <input
              type="text"
              value={form.chat.tawkWidgetId}
              onChange={(event) => setSectionField("chat", "tawkWidgetId", event.target.value)}
              className={inputClass}
              disabled={!form.chat.tawkEnabled}
            />
          </Field>
        </Section>
      </form>
    </div>
  );
}
