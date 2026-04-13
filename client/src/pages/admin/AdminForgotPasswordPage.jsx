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

export default function AdminForgotPasswordPage() {
  const startedAtRef = useRef(Date.now());
  const { branding } = useStoreBranding();
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
  const heroSrc = resolveAssetUrl(branding?.adminForgotPasswordHeroUrl) || adminLoginHero;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[220px] bg-slate-200 sm:min-h-[300px] lg:min-h-[560px]">
            <img
              src={heroSrc}
              alt="Admin workspace recovery preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.45)_100%)]" />
          </div>

          <div className="flex items-center bg-white">
            <div className="w-full px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
              <div className="mx-auto max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                  Account Recovery
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Forgot password
                </h1>

                <AuthNotice
                  id="admin-forgot-password-status"
                  tone={statusTone}
                  live={statusTone === "error" ? "assertive" : "polite"}
                  focusRef={statusRef}
                  className="mt-4 rounded-2xl text-xs"
                >
                  {statusMessage}
                </AuthNotice>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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
                    <label
                      htmlFor="admin-forgot-password-email"
                      className="text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>
                    <input
                      id="admin-forgot-password-email"
                      ref={emailRef}
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                      placeholder="staff@example.com"
                      autoComplete="email"
                      required
                    />
                    {firstFieldError(fieldErrors, "email") && (
                      <p className="mt-2 text-xs leading-6 text-rose-600">
                        {firstFieldError(fieldErrors, "email")}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || cooldownSeconds > 0}
                    className="w-full rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-500/70"
                  >
                    {isSubmitting
                      ? "Recovering password..."
                      : buildCooldownButtonLabel(cooldownSeconds, "Recover password")}
                  </button>
                </form>

                <div className="mt-5 border-t border-slate-200 pt-4">
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
