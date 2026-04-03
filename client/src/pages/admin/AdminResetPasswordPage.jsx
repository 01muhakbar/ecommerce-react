import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { adminResetPasswordSchema } from "@ecommerce/schemas";
import { confirmAdminPasswordReset } from "../../api/adminPublicAuth.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import PasswordStrengthIndicator from "../../components/auth/PasswordStrengthIndicator.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import {
  PASSWORD_CONFIRM_HELPER,
  RESET_PASSWORD_INVALID_MESSAGE,
  buildCooldownButtonLabel,
  buildRetryAfterMessage,
} from "../../utils/authUi.js";

const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Password reset complete. Sign in to Admin Workspace with your new password.";

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

export default function AdminResetPasswordPage() {
  const navigate = useNavigate();
  const startedAtRef = useRef(Date.now());
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const statusRef = useRef(null);
  const [searchParams] = useSearchParams();
  const token = String(searchParams.get("token") || "").trim();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (firstFieldError(fieldErrors, "password") && passwordRef.current) {
      passwordRef.current.focus();
      return;
    }
    if (firstFieldError(fieldErrors, "passwordConfirm") && confirmPasswordRef.current) {
      confirmPasswordRef.current.focus();
      return;
    }
    if (statusMessage && statusRef.current) {
      statusRef.current.focus();
    }
  }, [fieldErrors, statusMessage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setStatusMessage("");
    setStatusTone("neutral");

    const payload = {
      token,
      password,
      passwordConfirm,
      honeypot,
      startedAt: startedAtRef.current,
    };
    const parsed = adminResetPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await confirmAdminPasswordReset(parsed.data);
      navigate("/admin/login", {
        replace: true,
        state: {
          authNotice: result?.message || RESET_PASSWORD_SUCCESS_MESSAGE,
        },
      });
    } catch (error) {
      setFieldErrors(toFieldErrors(error));
      const retryAfterSeconds = getRetryAfterSeconds(error);
      setStatusMessage(
        error?.response?.status === 429 && retryAfterSeconds > 0
          ? buildRetryAfterMessage(retryAfterSeconds)
          : error?.response?.data?.message || RESET_PASSWORD_INVALID_MESSAGE
      );
      setStatusTone("error");
      if (retryAfterSeconds > 0) {
        setCooldownSeconds(retryAfterSeconds);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Reset password</h1>
          <AuthNotice tone="error" live="assertive" className="mt-4">
            This reset link is incomplete or invalid. Request a new Admin Workspace password reset email.
          </AuthNotice>
          <p className="mt-4 text-sm text-slate-500">
            <Link to="/admin/forgot-password" className="font-semibold text-slate-900 hover:underline">
              Go to forgot password
            </Link>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Reset links for Admin Workspace are time-limited and can only be used once.
        </p>

        <AuthNotice
          id="admin-reset-password-status"
          tone={statusTone}
          live={statusTone === "error" ? "assertive" : "polite"}
          focusRef={statusRef}
          className="mt-4"
        >
          {statusMessage}
        </AuthNotice>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="hidden" aria-hidden="true">
            <label htmlFor="admin-reset-password-company">Company</label>
            <input
              id="admin-reset-password-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>

          <div>
            <label
              htmlFor="admin-reset-password-new"
              className="text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              New password
            </label>
            <div className="relative mt-2">
              <input
                id="admin-reset-password-new"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-14 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
                required
              />
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
            </div>
            <PasswordStrengthIndicator password={password} />
            {firstFieldError(fieldErrors, "password") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "password")}</p>
            ) : null}
          </div>

          <div>
            <label
              htmlFor="admin-reset-password-confirm"
              className="text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              Confirm new password
            </label>
            <div className="relative mt-2">
              <input
                id="admin-reset-password-confirm"
                ref={confirmPasswordRef}
                type={showPasswordConfirm ? "text" : "password"}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-14 text-sm"
                placeholder="Repeat your new password"
                autoComplete="new-password"
                required
              />
              <PasswordVisibilityButton
                visible={showPasswordConfirm}
                onToggle={() => setShowPasswordConfirm((value) => !value)}
                labelShow="Show password confirmation"
                labelHide="Hide password confirmation"
              />
            </div>
            {firstFieldError(fieldErrors, "passwordConfirm") ? (
              <p className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "passwordConfirm")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">{PASSWORD_CONFIRM_HELPER}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || cooldownSeconds > 0}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting
              ? "Resetting password..."
              : buildCooldownButtonLabel(cooldownSeconds, "Reset password")}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Need a new link?{" "}
          <Link to="/admin/forgot-password" className="font-semibold text-slate-900 hover:underline">
            Request another reset email
          </Link>
        </p>
      </section>
    </div>
  );
}
