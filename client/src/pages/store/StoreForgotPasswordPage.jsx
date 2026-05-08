import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordSchema } from "@ecommerce/schemas";
import { requestClientPasswordReset } from "../../api/storeAuth.ts";
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

export default function StoreForgotPasswordPage() {
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
    const parsed = forgotPasswordSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await requestClientPasswordReset(parsed.data);
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
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Forgot password</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter the email linked to your account. For privacy, we show the same response whether or not it is registered.
      </p>

      <AuthNotice
        id="forgot-password-status"
        tone={statusTone}
        live={statusTone === "error" ? "assertive" : "polite"}
        focusRef={statusRef}
        className="mt-4"
      >
        {statusMessage}
      </AuthNotice>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="hidden" aria-hidden="true">
          <label htmlFor="forgot-password-company">Company</label>
          <input
            id="forgot-password-company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(event) => setHoneypot(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="forgot-password-email" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Email
          </label>
          <input
            id="forgot-password-email"
            ref={emailRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="you@email.com"
            autoComplete="email"
            aria-invalid={Boolean(firstFieldError(fieldErrors, "email"))}
            aria-describedby={
              firstFieldError(fieldErrors, "email")
                ? "forgot-password-email-error"
                : "forgot-password-email-helper"
            }
            required
          />
          {firstFieldError(fieldErrors, "email") ? (
            <p id="forgot-password-email-error" className="mt-2 text-xs text-rose-600">
              {firstFieldError(fieldErrors, "email")}
            </p>
          ) : (
            <p id="forgot-password-email-helper" className="mt-2 text-xs text-slate-500">
              We always return a generic response to protect account privacy.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || cooldownSeconds > 0}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting
            ? "Sending reset link..."
            : buildCooldownButtonLabel(cooldownSeconds, "Send reset link")}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        Remembered your password?{" "}
        <Link to="/auth/login" className="font-semibold text-slate-900 hover:underline">
          Back to sign in
        </Link>
      </p>
    </section>
  );
}
