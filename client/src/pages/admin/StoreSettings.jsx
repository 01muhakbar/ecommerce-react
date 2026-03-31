import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchAdminStoreSettings,
  updateAdminStoreSettings,
} from "../../lib/adminApi.js";

const STRIPE_PUBLISHABLE_KEY_REGEX = /^pk_(test|live)_[A-Za-z0-9]+$/;
const STRIPE_SECRET_KEY_REGEX = /^sk_(test|live)_[A-Za-z0-9]+$/;
const STRIPE_WEBHOOK_SECRET_REGEX = /^whsec_[A-Za-z0-9]+$/;
const RAZORPAY_KEY_ID_REGEX = /^rzp_(test|live)_[A-Za-z0-9]+$/;
const RAZORPAY_SECRET_REGEX = /^[A-Za-z0-9_-]{8,128}$/;
const GOOGLE_ANALYTICS_KEY_REGEX = /^(G|AW|UA)-[A-Z0-9-]+$/i;
const TAWK_ID_REGEX = /^[A-Za-z0-9]{6,64}$/;

const DEFAULT_STORE_SETTINGS = {
  payments: {
    cashOnDeliveryEnabled: true,
    stripeEnabled: true,
    stripeKey: "",
    stripeSecret: "",
    stripeWebhookSecret: "",
    razorPayEnabled: false,
    razorPayKeyId: "",
    razorPayKeySecret: "",
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
      stripeWebhookSecret: toText(
        paymentsSource.stripeWebhookSecret,
        DEFAULT_STORE_SETTINGS.payments.stripeWebhookSecret
      ),
      razorPayEnabled: toBool(
        paymentsSource.razorPayEnabled,
        DEFAULT_STORE_SETTINGS.payments.razorPayEnabled
      ),
      razorPayKeyId: toText(
        paymentsSource.razorPayKeyId,
        DEFAULT_STORE_SETTINGS.payments.razorPayKeyId
      ),
      razorPayKeySecret: toText(
        paymentsSource.razorPayKeySecret,
        DEFAULT_STORE_SETTINGS.payments.razorPayKeySecret
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
      tawkEnabled: toBool(chatSource.tawkEnabled, DEFAULT_STORE_SETTINGS.chat.tawkEnabled),
      tawkPropertyId: toText(
        chatSource.tawkPropertyId,
        DEFAULT_STORE_SETTINGS.chat.tawkPropertyId
      ),
      tawkWidgetId: toText(chatSource.tawkWidgetId, DEFAULT_STORE_SETTINGS.chat.tawkWidgetId),
    },
  };
};

const buildFatalIssues = (form) => {
  const issues = [];
  const stripeKey = toText(form.payments.stripeKey, "");
  const stripeSecret = toText(form.payments.stripeSecret, "");
  const stripeWebhookSecret = toText(form.payments.stripeWebhookSecret, "");
  const razorPayKeyId = toText(form.payments.razorPayKeyId, "");
  const razorPayKeySecret = toText(form.payments.razorPayKeySecret, "");
  const analyticsKey = toText(form.analytics.googleAnalyticKey, "");
  const tawkPropertyId = toText(form.chat.tawkPropertyId, "");
  const tawkWidgetId = toText(form.chat.tawkWidgetId, "");

  if (
    form.payments.stripeEnabled &&
    stripeKey &&
    !STRIPE_PUBLISHABLE_KEY_REGEX.test(stripeKey)
  ) {
    issues.push("Stripe key format is invalid.");
  }
  if (
    form.payments.stripeEnabled &&
    stripeSecret &&
    !STRIPE_SECRET_KEY_REGEX.test(stripeSecret)
  ) {
    issues.push("Stripe secret format is invalid.");
  }
  if (
    form.payments.stripeEnabled &&
    stripeWebhookSecret &&
    !STRIPE_WEBHOOK_SECRET_REGEX.test(stripeWebhookSecret)
  ) {
    issues.push("Stripe webhook secret format is invalid.");
  }
  if (
    form.payments.razorPayEnabled &&
    razorPayKeyId &&
    !RAZORPAY_KEY_ID_REGEX.test(razorPayKeyId)
  ) {
    issues.push("Razorpay key id format is invalid.");
  }
  if (
    form.payments.razorPayEnabled &&
    razorPayKeySecret &&
    !RAZORPAY_SECRET_REGEX.test(razorPayKeySecret)
  ) {
    issues.push("Razorpay secret format is invalid.");
  }
  if (
    form.analytics.googleAnalyticsEnabled &&
    analyticsKey &&
    !GOOGLE_ANALYTICS_KEY_REGEX.test(analyticsKey)
  ) {
    issues.push("Google Analytics key format is invalid.");
  }
  if (form.chat.tawkEnabled && tawkPropertyId && !TAWK_ID_REGEX.test(tawkPropertyId)) {
    issues.push("Tawk property id format is invalid.");
  }
  if (form.chat.tawkEnabled && tawkWidgetId && !TAWK_ID_REGEX.test(tawkWidgetId)) {
    issues.push("Tawk widget id format is invalid.");
  }

  return issues;
};

const inputClass =
  "mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50";

const toneClassByCode = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  slate: "border-slate-200 bg-slate-100 text-slate-600",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-sky-200 bg-sky-50 text-sky-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
};

function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </label>
  );
}

function ToggleField({ label, value, onChange, hint }) {
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
      {hint ? <p className="mt-3 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Section({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-slate-800">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function StatusBadge({ status }) {
  const tone = toneClassByCode[status?.tone] || toneClassByCode.slate;
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {status?.label || "Unknown"}
    </span>
  );
}

function StatusCard({ title, diagnostic, helper, extra }) {
  const status = diagnostic?.status || {};
  const details = []
    .concat(Array.isArray(status?.missingFields) ? status.missingFields : [])
    .concat(Array.isArray(status?.invalidFields) ? status.invalidFields : []);
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        <StatusBadge status={status} />
      </div>
      {helper ? <p className="mt-2 text-xs text-slate-500">{helper}</p> : null}
      {details.length > 0 ? (
        <p className="mt-2 text-xs text-slate-500">Needs attention: {details.join(", ")}</p>
      ) : null}
      {extra ? <div className="mt-2 text-xs text-slate-500">{extra}</div> : null}
    </div>
  );
}

const buildSecretHint = (diagnostic, label) => {
  if (!diagnostic?.secretConfigured) {
    return `${label} is not stored yet.`;
  }
  const masked = toText(diagnostic.secretMask, "");
  return `Saved ${label.toLowerCase()}: ${masked || "configured"}. Leave blank to keep it unchanged.`;
};

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
      queryClient.invalidateQueries({ queryKey: ["store-settings", "public"], exact: false });
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
  const diagnostics = mutation.data?.diagnostics || settingsQuery.data?.diagnostics || {};
  const localFatalIssues = useMemo(() => buildFatalIssues(form), [form]);
  const checkoutAvailableMethods = Array.isArray(
    diagnostics?.payments?.checkout?.availableMethods
  )
    ? diagnostics.payments.checkout.availableMethods
    : [];
  const isSubmitDisabled = isSaving || localFatalIssues.length > 0;

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
    if (localFatalIssues.length > 0) {
      setFeedback({
        type: "error",
        message: "Resolve invalid configuration fields before saving.",
      });
      return;
    }
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
          <div>
            <h1 className="text-[22px] font-semibold leading-none text-slate-800">
              Store Settings
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Backend-driven settings for checkout, auth entry points, analytics, and chat.
            </p>
          </div>
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className="h-10 min-w-[110px] rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Updating..." : "Update"}
          </button>
        </div>

        {feedback ? <div className={statusBoxClass}>{feedback.message}</div> : null}

        {localFatalIssues.length > 0 ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <p className="font-semibold">Fatal validation</p>
            <ul className="mt-2 list-disc pl-5">
              {localFatalIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Section
          title="Payment Methods"
          description="Checkout reads available methods from backend settings. Unsupported runtimes stay honest and never appear as selectable in client checkout."
        >
          <StatusCard
            title="Checkout Availability"
            diagnostic={{
              status: {
                label:
                  checkoutAvailableMethods.length > 0
                    ? `${checkoutAvailableMethods.length} method active`
                    : "No active method",
                tone: checkoutAvailableMethods.length > 0 ? "emerald" : "amber",
              },
            }}
            helper={
              checkoutAvailableMethods.length > 0
                ? `Client checkout currently receives: ${checkoutAvailableMethods
                    .map((method) => method.label)
                    .join(", ")}`
                : "Client checkout currently has no active payment method."
            }
          />
          <StatusCard
            title="Cash on Delivery"
            diagnostic={diagnostics?.payments?.cashOnDelivery}
            helper="This is the only payment runtime currently wired into the store checkout flow."
          />
          <ToggleField
            label="Cash On Delivery"
            value={form.payments.cashOnDeliveryEnabled}
            onChange={(value) => setSectionField("payments", "cashOnDeliveryEnabled", value)}
            hint="Turning this off removes COD from client checkout immediately."
          />
          <div />

          <StatusCard
            title="Stripe"
            diagnostic={diagnostics?.payments?.stripe}
            helper="When valid and enabled, Stripe appears in single-store client checkout and redirects buyers to hosted Stripe Checkout."
            extra={buildSecretHint(diagnostics?.payments?.stripe, "secret")}
          />
          <ToggleField
            label="Stripe Payment"
            value={form.payments.stripeEnabled}
            onChange={(value) => setSectionField("payments", "stripeEnabled", value)}
            hint="Enabled without valid credentials will remain incomplete and never surface in checkout."
          />
          <Field label="Stripe Key">
            <input
              type="text"
              value={form.payments.stripeKey}
              onChange={(event) => setSectionField("payments", "stripeKey", event.target.value)}
              className={inputClass}
              disabled={!form.payments.stripeEnabled}
              placeholder="pk_test_..."
            />
          </Field>
          <Field
            label="Stripe Secret"
            hint={buildSecretHint(diagnostics?.payments?.stripe, "secret")}
          >
            <input
              type="password"
              value={form.payments.stripeSecret}
              onChange={(event) =>
                setSectionField("payments", "stripeSecret", event.target.value)
              }
              className={inputClass}
              disabled={!form.payments.stripeEnabled}
              placeholder="sk_test_..."
            />
          </Field>
          <StatusCard
            title="Stripe Webhook"
            diagnostic={diagnostics?.payments?.stripeWebhook}
            helper="Webhook finalizes payment from Stripe events so order status does not depend on buyer returning to the success page."
            extra={buildSecretHint(diagnostics?.payments?.stripeWebhook, "secret")}
          />
          <Field
            label="Stripe Webhook Secret"
            hint={buildSecretHint(diagnostics?.payments?.stripeWebhook, "secret")}
          >
            <input
              type="password"
              value={form.payments.stripeWebhookSecret}
              onChange={(event) =>
                setSectionField("payments", "stripeWebhookSecret", event.target.value)
              }
              className={inputClass}
              disabled={!form.payments.stripeEnabled}
              placeholder="whsec_..."
            />
          </Field>

          <StatusCard
            title="Razorpay"
            diagnostic={diagnostics?.payments?.razorpay}
            helper="Configuration is stored and validated, but checkout runtime is not connected in this repo yet."
            extra={buildSecretHint(diagnostics?.payments?.razorpay, "secret")}
          />
          <ToggleField
            label="Razorpay"
            value={form.payments.razorPayEnabled}
            onChange={(value) => setSectionField("payments", "razorPayEnabled", value)}
            hint="Enabled without valid credentials will remain incomplete and never surface in checkout."
          />
          <Field label="Razorpay Key ID">
            <input
              type="text"
              value={form.payments.razorPayKeyId}
              onChange={(event) =>
                setSectionField("payments", "razorPayKeyId", event.target.value)
              }
              className={inputClass}
              disabled={!form.payments.razorPayEnabled}
              placeholder="rzp_test_..."
            />
          </Field>
          <Field
            label="Razorpay Key Secret"
            hint={buildSecretHint(diagnostics?.payments?.razorpay, "secret")}
          >
            <input
              type="password"
              value={form.payments.razorPayKeySecret}
              onChange={(event) =>
                setSectionField("payments", "razorPayKeySecret", event.target.value)
              }
              className={inputClass}
              disabled={!form.payments.razorPayEnabled}
            />
          </Field>
        </Section>

        <Section
          title="Social Login"
          description="These providers now persist credentials and status honestly. Client buttons only appear if backend says the provider is truly usable."
        >
          <StatusCard
            title="Google Login"
            diagnostic={diagnostics?.socialLogin?.google}
            helper="OAuth runtime is not wired here, so configured providers remain non-public until that flow exists."
            extra={buildSecretHint(diagnostics?.socialLogin?.google, "secret")}
          />
          <ToggleField
            label="Google Login"
            value={form.socialLogin.googleEnabled}
            onChange={(value) => setSectionField("socialLogin", "googleEnabled", value)}
          />
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
          <Field
            label="Google Secret Key"
            hint={buildSecretHint(diagnostics?.socialLogin?.google, "secret")}
          >
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

          <StatusCard
            title="Github Login"
            diagnostic={diagnostics?.socialLogin?.github}
            helper="Configured metadata is stored, but public login stays hidden until OAuth runtime exists."
            extra={buildSecretHint(diagnostics?.socialLogin?.github, "secret")}
          />
          <ToggleField
            label="Github Login"
            value={form.socialLogin.githubEnabled}
            onChange={(value) => setSectionField("socialLogin", "githubEnabled", value)}
          />
          <Field label="Github ID">
            <input
              type="text"
              value={form.socialLogin.githubId}
              onChange={(event) => setSectionField("socialLogin", "githubId", event.target.value)}
              className={inputClass}
              disabled={!form.socialLogin.githubEnabled}
            />
          </Field>
          <Field
            label="Github Secret"
            hint={buildSecretHint(diagnostics?.socialLogin?.github, "secret")}
          >
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

          <StatusCard
            title="Facebook Login"
            diagnostic={diagnostics?.socialLogin?.facebook}
            helper="Configured metadata is stored, but public login stays hidden until OAuth runtime exists."
            extra={buildSecretHint(diagnostics?.socialLogin?.facebook, "secret")}
          />
          <ToggleField
            label="Facebook Login"
            value={form.socialLogin.facebookEnabled}
            onChange={(value) => setSectionField("socialLogin", "facebookEnabled", value)}
          />
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
          <Field
            label="Facebook Secret"
            hint={buildSecretHint(diagnostics?.socialLogin?.facebook, "secret")}
          >
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

        <Section
          title="Analytics & Chat"
          description="Client only injects scripts from public-safe values that pass backend validation."
        >
          <StatusCard
            title="Google Analytics"
            diagnostic={diagnostics?.analytics?.googleAnalytics}
            helper="Measurement ID is exposed publicly only when enabled and valid."
          />
          <ToggleField
            label="Google Analytics"
            value={form.analytics.googleAnalyticsEnabled}
            onChange={(value) =>
              setSectionField("analytics", "googleAnalyticsEnabled", value)
            }
          />
          <Field
            label="Google Analytic Key"
            hint="Accepted examples: G-XXXXXXX, AW-XXXXXXX, UA-XXXXXXX"
          >
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

          <StatusCard
            title="Tawk Chat"
            diagnostic={diagnostics?.chat?.tawk}
            helper="Widget script is injected only when both IDs are enabled and valid."
          />
          <ToggleField
            label="Tawk Chat"
            value={form.chat.tawkEnabled}
            onChange={(value) => setSectionField("chat", "tawkEnabled", value)}
          />
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
