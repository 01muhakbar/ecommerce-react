import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { adminForgotPasswordSchema } from "@ecommerce/schemas";
import { requestAdminPasswordReset } from "../../api/adminPublicAuth.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import {
  FORGOT_PASSWORD_GENERIC_MESSAGE,
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

export default function AdminForgotPasswordPage() {
  const startedAtRef = useRef(Date.now());
  const emailRef = useRef(null);
  const statusRef = useRef(null);
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (firstFieldError(fieldErrors, "email") && emailRef.current) {
      emailRef.current.focus();
    }
  }, [fieldErrors]);

  useEffect(() => {
    if (statusMessage && statusRef.current) {
      statusRef.current.focus();
    }
  }, [statusMessage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFieldErrors({});
    setStatusMessage("");
    setStatusTone("neutral");

    const payload = {
      email,
      honeypot,
      startedAt: startedAtRef.current,
    };
    const parsed = adminForgotPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestAdminPasswordReset(parsed.data);
      setStatusMessage(result?.message || FORGOT_PASSWORD_GENERIC_MESSAGE);
      setStatusTone("success");
    } catch (error) {
      setFieldErrors(toFieldErrors(error));
      const retryAfterSeconds = getRetryAfterSeconds(error);
      setStatusMessage(
        error?.response?.status === 429 && retryAfterSeconds > 0
          ? buildRetryAfterMessage(retryAfterSeconds)
          : error?.response?.data?.message || "We couldn't process that request right now."
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
        <h1 className="text-2xl font-semibold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter your Admin Workspace email. For privacy, we return the same response whether or not the account exists.
        </p>

        <AuthNotice
          id="admin-forgot-password-status"
          tone={statusTone}
          live={statusTone === "error" ? "assertive" : "polite"}
          focusRef={statusRef}
          className="mt-4"
        >
          {statusMessage}
        </AuthNotice>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="hidden" aria-hidden="true">
            <label htmlFor="admin-forgot-password-company">Company</label>
            <input
              id="admin-forgot-password-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="admin-forgot-password-email" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Email
            </label>
            <input
              id="admin-forgot-password-email"
              ref={emailRef}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm"
              placeholder="staff@example.com"
              autoComplete="email"
              required
            />
            {firstFieldError(fieldErrors, "email") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "email")}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                We only send reset links for active Admin Workspace accounts, and we never confirm whether a specific email is registered.
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || cooldownSeconds > 0}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting
              ? "Sending reset link..."
              : buildCooldownButtonLabel(cooldownSeconds, "Send reset link")}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          Remembered your password?{" "}
          <Link to="/admin/login" className="font-semibold text-slate-900 hover:underline">
            Back to admin login
          </Link>
        </p>
      </section>
    </div>
  );
}
