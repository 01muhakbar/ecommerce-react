import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { adminStaffSignupSchema } from "@ecommerce/schemas";
import { registerAdminStaffAccount } from "../../api/adminPublicAuth.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import PasswordStrengthIndicator from "../../components/auth/PasswordStrengthIndicator.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import {
  buildCooldownButtonLabel,
  buildRetryAfterMessage,
} from "../../utils/authUi.js";
import adminLoginHero from "../../assets/admin-login-hero.jpg";
import useStoreBranding from "../../hooks/useStoreBranding.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

const toFieldErrors = (error) => {
  const flattened =
    error?.flatten?.()?.fieldErrors ||
    error?.response?.data?.errors?.fieldErrors ||
    error?.fieldErrors ||
    {};
  return flattened && typeof flattened === "object" ? flattened : {};
};

const firstFieldError = (fieldErrors, key) =>
  Array.isArray(fieldErrors?.[key]) && fieldErrors[key].length > 0 ? fieldErrors[key][0] : "";

export default function AdminCreateAccountPage() {
  const startedAtRef = useRef(Date.now());
  const { branding } = useStoreBranding();
  const statusRef = useRef(null);
  const fieldRefs = useRef({
    name: null,
    email: null,
    phoneNumber: null,
    password: null,
    passwordConfirm: null,
  });
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    passwordConfirm: "",
    honeypot: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    const firstErrorKey = Object.keys(fieldErrors || {}).find((key) =>
      Array.isArray(fieldErrors?.[key]) && fieldErrors[key].length > 0
    );
    if (firstErrorKey && fieldRefs.current[firstErrorKey]) {
      fieldRefs.current[firstErrorKey].focus();
      return;
    }
    if (statusMessage && statusRef.current) {
      statusRef.current.focus();
    }
  }, [fieldErrors, statusMessage]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current?.[key]) return current;
      return { ...current, [key]: undefined };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setStatusMessage("");
    setStatusTone("neutral");

    const payload = {
      ...form,
      startedAt: startedAtRef.current,
    };
    const parsed = adminStaffSignupSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerAdminStaffAccount(parsed.data);
      setStatusMessage(
        result?.message ||
          "Check your email to verify your staff account. After verification, Admin Workspace will review and approve your sign-in access."
      );
      setStatusTone("success");
    } catch (error) {
      setFieldErrors(toFieldErrors(error));
      const retryAfterSeconds = getRetryAfterSeconds(error);
      setStatusMessage(
        error?.response?.status === 429 && retryAfterSeconds > 0
          ? buildRetryAfterMessage(retryAfterSeconds)
          : error?.response?.data?.message || "We could not create this account right now."
      );
      setStatusTone("error");
      if (retryAfterSeconds > 0) {
        setCooldownSeconds(retryAfterSeconds);
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  const heroSrc = resolveAssetUrl(branding?.adminCreateAccountHeroUrl) || adminLoginHero;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-3 sm:px-6 sm:py-4 lg:px-8 lg:py-3">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:h-[calc(100vh-1.5rem)] lg:max-h-[640px] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative min-h-[220px] bg-slate-200 sm:min-h-[300px] lg:min-h-0">
            <img
              src={heroSrc}
              alt="Admin workspace account creation preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.48)_100%)]" />
          </div>

          <div className="flex items-center bg-white lg:overflow-y-auto">
            <div className="w-full px-6 py-6 sm:px-8 sm:py-7 lg:px-9 lg:pt-12 lg:pb-6">
              <div className="mx-auto max-w-[400px]">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                  Staff Signup
                </p>
                <h1 className="mt-1.5 text-[2rem] font-semibold tracking-tight text-slate-950">
                  Create account
                </h1>

                <AuthNotice
                  id="admin-create-account-status"
                  tone={statusTone}
                  live={statusTone === "error" ? "assertive" : "polite"}
                  focusRef={statusRef}
                  className="mt-3 rounded-2xl px-3 py-2 text-xs"
                >
                  {statusMessage}
                </AuthNotice>

                <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="admin-create-account-company">Company</label>
                    <input
                      id="admin-create-account-company"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={form.honeypot}
                      onChange={(event) => setField("honeypot", event.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="admin-create-account-name"
                        className="text-sm font-medium text-slate-700"
                      >
                        Name
                      </label>
                      <input
                        id="admin-create-account-name"
                        ref={(node) => {
                          fieldRefs.current.name = node;
                        }}
                        type="text"
                        value={form.name}
                        onChange={(event) => setField("name", event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                        placeholder="Your full name"
                        required
                      />
                      {firstFieldError(fieldErrors, "name") ? (
                        <p className="mt-1.5 text-xs leading-5 text-rose-600">
                          {firstFieldError(fieldErrors, "name")}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label
                        htmlFor="admin-create-account-email"
                        className="text-sm font-medium text-slate-700"
                      >
                        Email
                      </label>
                      <input
                        id="admin-create-account-email"
                        ref={(node) => {
                          fieldRefs.current.email = node;
                        }}
                        type="email"
                        value={form.email}
                        onChange={(event) => setField("email", event.target.value)}
                        className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                        placeholder="staff@example.com"
                        autoComplete="email"
                        required
                      />
                      {firstFieldError(fieldErrors, "email") ? (
                        <p className="mt-1.5 text-xs leading-5 text-rose-600">
                          {firstFieldError(fieldErrors, "email")}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="admin-create-account-phone"
                      className="text-sm font-medium text-slate-700"
                    >
                      WhatsApp / phone number
                    </label>
                    <input
                      id="admin-create-account-phone"
                      ref={(node) => {
                        fieldRefs.current.phoneNumber = node;
                      }}
                      type="tel"
                      value={form.phoneNumber}
                      onChange={(event) => setField("phoneNumber", event.target.value)}
                      className="mt-1.5 h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                      placeholder="+62 812 3456 7890"
                      autoComplete="tel"
                      required
                    />
                    {firstFieldError(fieldErrors, "phoneNumber") && (
                      <p className="mt-1.5 text-xs leading-5 text-rose-600">
                        {firstFieldError(fieldErrors, "phoneNumber")}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="admin-create-account-password"
                      className="text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>
                    <div className="relative mt-2">
                      <input
                        id="admin-create-account-password"
                        ref={(node) => {
                          fieldRefs.current.password = node;
                        }}
                        type={showPassword ? "text" : "password"}
                        value={form.password}
                        onChange={(event) => setField("password", event.target.value)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-14 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                      />
                      <PasswordVisibilityButton
                        visible={showPassword}
                        onToggle={() => setShowPassword((prev) => !prev)}
                      />
                    </div>
                    <PasswordStrengthIndicator password={form.password} />
                    {firstFieldError(fieldErrors, "password") ? (
                      <p className="mt-1.5 text-xs leading-5 text-rose-600">
                        {firstFieldError(fieldErrors, "password")}
                      </p>
                    ) : null}
                  </div>

                  <div>
                    <label
                      htmlFor="admin-create-account-password-confirm"
                      className="text-sm font-medium text-slate-700"
                    >
                      Confirm password
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="admin-create-account-password-confirm"
                        ref={(node) => {
                          fieldRefs.current.passwordConfirm = node;
                        }}
                        type={showPasswordConfirm ? "text" : "password"}
                        value={form.passwordConfirm}
                        onChange={(event) => setField("passwordConfirm", event.target.value)}
                        className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-14 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                        placeholder="Repeat your password"
                        autoComplete="new-password"
                        required
                      />
                      <PasswordVisibilityButton
                        visible={showPasswordConfirm}
                        onToggle={() => setShowPasswordConfirm((prev) => !prev)}
                        labelShow="Show password confirmation"
                        labelHide="Hide password confirmation"
                      />
                    </div>
                    {firstFieldError(fieldErrors, "passwordConfirm") ? (
                      <p className="mt-1.5 text-xs leading-5 text-rose-600">
                        {firstFieldError(fieldErrors, "passwordConfirm")}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || cooldownSeconds > 0}
                    className="w-full rounded-2xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-500/70"
                  >
                    {isSubmitting
                      ? "Creating account..."
                      : buildCooldownButtonLabel(cooldownSeconds, "Create account")}
                  </button>
                </form>

                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-sm text-slate-500">
                    Already have an account?{" "}
                    <Link
                      to="/admin/login"
                      className="font-semibold text-teal-700 transition hover:text-teal-800 hover:underline"
                    >
                      Login
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
