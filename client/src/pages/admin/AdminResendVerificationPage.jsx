import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { adminResendVerificationSchema } from "@ecommerce/schemas";
import { resendAdminStaffVerification } from "../../api/adminPublicAuth.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import { buildCooldownButtonLabel, buildRetryAfterMessage } from "../../utils/authUi.js";

const GENERIC_RESEND_MESSAGE =
  "If the account is pending verification, we have sent another verification email.";

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

export default function AdminResendVerificationPage() {
  const [searchParams] = useSearchParams();
  const startedAtRef = useRef(Date.now());
  const emailRef = useRef(null);
  const statusRef = useRef(null);
  const [email, setEmail] = useState(String(searchParams.get("email") || "").trim());
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
      email,
      honeypot,
      startedAt: startedAtRef.current,
    };
    const parsed = adminResendVerificationSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(toFieldErrors(parsed.error));
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await resendAdminStaffVerification(parsed.data);
      setStatusMessage(result?.message || GENERIC_RESEND_MESSAGE);
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
        <h1 className="text-2xl font-semibold text-slate-900">Resend verification email</h1>
        <p className="mt-2 text-sm text-slate-500">
          Enter the email used for your Admin Workspace Staff signup. For privacy, we return a generic response.
        </p>

        <AuthNotice
          id="admin-resend-verification-status"
          tone={statusTone}
          live={statusTone === "error" ? "assertive" : "polite"}
          focusRef={statusRef}
          className="mt-4"
        >
          {statusMessage}
        </AuthNotice>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="hidden" aria-hidden="true">
            <label htmlFor="admin-resend-verification-company">Company</label>
            <input
              id="admin-resend-verification-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(event) => setHoneypot(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="admin-resend-verification-email"
              className="text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              Email
            </label>
            <input
              id="admin-resend-verification-email"
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
                Resend only applies to self-signup Staff accounts that are still waiting for email verification. Inactive or already-approved accounts will not receive another verification email.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || cooldownSeconds > 0}
            className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting
              ? "Sending verification email..."
              : buildCooldownButtonLabel(cooldownSeconds, "Resend verification email")}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-sm text-slate-500">
          <p>
            <Link to="/admin/login" className="font-semibold text-slate-900 hover:underline">
              Back to admin login
            </Link>
          </p>
          <p>
            <Link to="/admin/create-account" className="font-semibold text-slate-900 hover:underline">
              Create a new Staff account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
