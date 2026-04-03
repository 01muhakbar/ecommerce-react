import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { adminStaffSignupSchema } from "@ecommerce/schemas";
import { registerAdminStaffAccount } from "../../api/adminPublicAuth.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import PasswordStrengthIndicator from "../../components/auth/PasswordStrengthIndicator.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import {
  PASSWORD_CONFIRM_HELPER,
  PASSWORD_RULES_HELPER,
  buildCooldownButtonLabel,
  buildRetryAfterMessage,
} from "../../utils/authUi.js";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Create Staff Account</h1>
        <p className="mt-2 text-sm text-slate-500">
          Accounts created here always start as <span className="font-semibold text-slate-700">Staff</span>, stay locked until the verification email is completed, and require Admin Workspace approval before sign-in.
        </p>

        <AuthNotice
          id="admin-create-account-status"
          tone={statusTone}
          live={statusTone === "error" ? "assertive" : "polite"}
          focusRef={statusRef}
          className="mt-4"
        >
          {statusMessage}
        </AuthNotice>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
          <div>
            <label htmlFor="admin-create-account-name" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Full name
            </label>
            <input
              id="admin-create-account-name"
              ref={(node) => {
                fieldRefs.current.name = node;
              }}
              type="text"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="Your full name"
              required
            />
            {firstFieldError(fieldErrors, "name") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "name")}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="admin-create-account-email" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
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
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="staff@example.com"
              autoComplete="email"
              required
            />
            {firstFieldError(fieldErrors, "email") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "email")}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="admin-create-account-phone" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
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
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="+62 812 3456 7890"
              autoComplete="tel"
              required
            />
            {firstFieldError(fieldErrors, "phoneNumber") ? (
              <p className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "phoneNumber")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Use an active number for account recovery and workspace contact.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="admin-create-account-password" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
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
                className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-14 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">{PASSWORD_RULES_HELPER}</p>
            <PasswordStrengthIndicator password={form.password} />
            {firstFieldError(fieldErrors, "password") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "password")}</p>
            ) : null}
          </div>
          <div>
            <label htmlFor="admin-create-account-password-confirm" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Confirm password
            </label>
            <div className="relative mt-2">
              <input
                id="admin-create-account-password-confirm"
                ref={(node) => {
                  fieldRefs.current.passwordConfirm = node;
                }}
                type={showPasswordConfirm ? "text" : "password"}
                value={form.passwordConfirm}
                onChange={(event) => setField("passwordConfirm", event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-14 text-sm"
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
            <p className="mt-2 text-xs text-slate-500">{PASSWORD_CONFIRM_HELPER}</p>
            {firstFieldError(fieldErrors, "passwordConfirm") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "passwordConfirm")}</p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || cooldownSeconds > 0}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting
              ? "Creating account..."
              : buildCooldownButtonLabel(cooldownSeconds, "Create account")}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Already verified?{" "}
          <Link to="/admin/login" className="font-semibold text-slate-900 hover:underline">
            Back to admin login
          </Link>
        </p>
      </section>
    </div>
  );
}
