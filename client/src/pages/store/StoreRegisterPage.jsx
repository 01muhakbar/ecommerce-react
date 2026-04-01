import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  clientRegistrationSchema,
  clientRegistrationVerifySchema,
} from "@ecommerce/schemas";
import { useAccountAuth } from "../../auth/authDomainHooks.js";
import { useCart } from "../../hooks/useCart.ts";
import * as cartApi from "../../api/cartApi.ts";
import { clearGuestCart, getGuestCart } from "../../utils/guestCart.ts";
import {
  registerClientAccount,
  resendClientRegistrationOtp,
  verifyClientRegistrationOtp,
} from "../../api/storeAuth.ts";

const PENDING_ADD_KEY = "pending_cart_add";
const PENDING_ADD_CONSUMED_KEY = "pending_cart_add_consumed";
const PENDING_REGISTRATION_KEY = "client_pending_registration";

const readPendingRegistration = () => {
  try {
    const raw = sessionStorage.getItem(PENDING_REGISTRATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const writePendingRegistration = (value) => {
  try {
    if (value) {
      sessionStorage.setItem(PENDING_REGISTRATION_KEY, JSON.stringify(value));
      return;
    }
    sessionStorage.removeItem(PENDING_REGISTRATION_KEY);
  } catch {
    // ignore storage errors
  }
};

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

const getErrorCode = (error) => String(error?.response?.data?.code || error?.code || "").trim();

const getErrorMessage = (error, fallback) =>
  String(error?.response?.data?.message || error?.message || fallback || "").trim();

const hasFieldErrors = (fieldErrors) =>
  Boolean(
    fieldErrors &&
      typeof fieldErrors === "object" &&
      Object.values(fieldErrors).some((messages) => Array.isArray(messages) && messages.length > 0)
  );

const resolveRegisterErrorPresentation = (error) => {
  const fieldErrors = toFieldErrors(error);
  const code = getErrorCode(error);
  const pending = error?.response?.data?.data?.pending || null;

  if (hasFieldErrors(fieldErrors)) {
    return {
      fieldErrors,
      pending,
      statusMessage: "",
      statusTone: "neutral",
    };
  }

  if (code === "OTP_DELIVERY_FAILED") {
    return {
      fieldErrors: {},
      pending,
      statusMessage: getErrorMessage(
        error,
        "Your account is pending verification, but we could not send the code right now."
      ),
      statusTone: pending ? "warning" : "error",
    };
  }

  if (code === "REQUEST_REJECTED") {
    return {
      fieldErrors: {},
      pending,
      statusMessage: getErrorMessage(
        error,
        "We could not process this registration request."
      ),
      statusTone: "error",
    };
  }

  return {
    fieldErrors: {},
    pending,
    statusMessage: getErrorMessage(error, "Registration failed. Please try again."),
    statusTone: pending ? "warning" : "error",
  };
};

const resolveVerifyErrorPresentation = (error) => {
  const pending = error?.response?.data?.data?.pending || null;
  const code = getErrorCode(error);
  const message = getErrorMessage(error, "The verification code is invalid or expired.");

  if (code === "OTP_INVALID_OR_EXPIRED" || code === "OTP_ATTEMPTS_EXCEEDED") {
    return {
      pending,
      fieldErrors: {
        otpCode: [message],
      },
      statusMessage: "",
      statusTone: "neutral",
    };
  }

  return {
    pending,
    fieldErrors: {
      otpCode: [message],
    },
    statusMessage: message,
    statusTone: "error",
  };
};

const getPasswordHint = (password) => {
  if (!password) return "Use at least 8 characters with letters and numbers.";
  if (password.length < 8) return "Password is too short.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Add at least one letter and one number.";
  }
  return "Password strength looks good.";
};

export default function StoreRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeSettings } = useOutletContext() || {};
  const { refreshSession, isAuthenticated } = useAccountAuth();
  const { refreshCart } = useCart();
  const startedAtRef = useRef(Date.now());
  const [form, setForm] = useState({
    name: "",
    email: "",
    phoneNumber: "",
    password: "",
    passwordConfirm: "",
    termsAccepted: false,
    honeypot: "",
  });
  const [verificationCode, setVerificationCode] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [pendingRegistration, setPendingRegistration] = useState(() => readPendingRegistration());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(
    Number(readPendingRegistration()?.verification?.resendAvailableInSeconds || 0)
  );
  const socialLogin = storeSettings?.socialLogin || {};
  const socialButtons = [
    { id: "google", label: "Continue with Google", enabled: Boolean(socialLogin.googleEnabled) },
    { id: "github", label: "Continue with Github", enabled: Boolean(socialLogin.githubEnabled) },
    {
      id: "facebook",
      label: "Continue with Facebook",
      enabled: Boolean(socialLogin.facebookEnabled),
    },
  ].filter((item) => item.enabled);

  const currentStep = pendingRegistration ? "verify" : "register";
  const passwordHint = useMemo(() => getPasswordHint(form.password), [form.password]);
  const pendingVerification = pendingRegistration?.verification || null;
  const canSubmitOtp = pendingVerification?.canSubmitOtp !== false;
  const deliveryFailed = pendingVerification?.deliveryStatus === "FAILED";

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/account", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const locationPending = location.state?.pendingRegistration || location.state?.pendingVerification;
    if (locationPending && typeof locationPending === "object") {
      setPendingRegistration(locationPending);
      writePendingRegistration(locationPending);
      setCountdown(Number(locationPending?.verification?.resendAvailableInSeconds || 0));
      if (location.state?.pendingNotice) {
        setStatusMessage(String(location.state.pendingNotice));
        setStatusTone("warning");
      }
    }
  }, [location.state]);

  useEffect(() => {
    writePendingRegistration(pendingRegistration);
    setCountdown(Number(pendingRegistration?.verification?.resendAvailableInSeconds || 0));
  }, [pendingRegistration]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown]);

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current?.[key]) return current;
      return { ...current, [key]: undefined };
    });
  };

  const mergeGuestCart = async () => {
    try {
      const guest = getGuestCart();
      const items = Array.isArray(guest?.items) ? guest.items : [];
      if (items.length === 0) return;
      for (const item of items) {
        const id = Number(item?.productId);
        const qty = Math.max(1, Number(item?.qty) || 1);
        if (!Number.isFinite(id) || id <= 0) continue;
        await cartApi.addToCart(id, qty);
      }
      clearGuestCart();
    } catch (mergeError) {
      if (import.meta.env.DEV) {
        console.warn("[store-register] guest cart merge failed", mergeError);
      }
    }
  };

  const mergePendingAdd = async () => {
    try {
      const raw = localStorage.getItem(PENDING_ADD_KEY);
      if (!raw) return null;
      localStorage.removeItem(PENDING_ADD_KEY);
      const parsed = JSON.parse(raw);
      const nonce = parsed?.nonce;
      if (nonce) {
        const consumed = sessionStorage.getItem(PENDING_ADD_CONSUMED_KEY);
        if (consumed === String(nonce)) {
          return null;
        }
        sessionStorage.setItem(PENDING_ADD_CONSUMED_KEY, String(nonce));
      }
      const id = Number(parsed?.productId);
      const qty = Math.max(1, Number(parsed?.qty) || 1);
      if (Number.isFinite(id) && id > 0) {
        await cartApi.addToCart(id, qty);
      }
      return typeof parsed?.from === "string" ? parsed.from : null;
    } catch (mergeError) {
      if (import.meta.env.DEV) {
        console.warn("[store-register] pending add merge failed", mergeError);
      }
      return null;
    }
  };

  const completeAuthenticatedRegistration = async () => {
    await mergeGuestCart();
    const pendingFrom = await mergePendingAdd();
    await refreshSession();
    await refreshCart(false);
    writePendingRegistration(null);
    setPendingRegistration(null);
    const fromState = location.state?.from;
    const resolvedFrom =
      typeof fromState === "string"
        ? fromState
        : fromState && fromState.pathname
          ? `${fromState.pathname || ""}${fromState.search || ""}${fromState.hash || ""}`
          : null;
    const target =
      pendingFrom && pendingFrom !== "/auth/register"
        ? pendingFrom
        : resolvedFrom && resolvedFrom !== "/auth/register"
          ? resolvedFrom
          : "/account";
    navigate(target, { replace: true });
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setStatusMessage("");
    setStatusTone("neutral");
    setFieldErrors({});
    const payload = {
      ...form,
      startedAt: startedAtRef.current,
    };
    const parsed = clientRegistrationSchema.safeParse(payload);
    if (!parsed.success) {
      const nextFieldErrors = toFieldErrors(parsed.error);
      setFieldErrors(nextFieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await registerClientAccount(parsed.data);
      const pending = result?.data?.pendingRegistration || null;
      if (pending) {
        setPendingRegistration(pending);
        setVerificationCode("");
      }
      setStatusMessage(result?.message || "Verification code sent to your email.");
      setStatusTone("success");
    } catch (error) {
      const presentation = resolveRegisterErrorPresentation(error);
      setFieldErrors(presentation.fieldErrors);
      const pending = presentation.pending;
      if (pending) {
        setPendingRegistration(pending);
      }
      setStatusMessage(presentation.statusMessage);
      setStatusTone(presentation.statusTone);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySubmit = async (event) => {
    event.preventDefault();
    if (!pendingVerification?.verificationId) {
      setStatusMessage("Start your registration again to request a new code.");
      setStatusTone("error");
      return;
    }

    setStatusMessage("");
    setStatusTone("neutral");
    setFieldErrors((current) => ({
      ...current,
      otpCode: undefined,
    }));
    const parsed = clientRegistrationVerifySchema.safeParse({
      verificationId: pendingVerification.verificationId,
      otpCode: verificationCode,
    });
    if (!parsed.success) {
      const nextFieldErrors = toFieldErrors(parsed.error);
      setFieldErrors((current) => ({ ...current, ...nextFieldErrors }));
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyClientRegistrationOtp(parsed.data);
      setStatusMessage(result?.message || "Your account is now active.");
      setStatusTone("success");
      await completeAuthenticatedRegistration();
    } catch (error) {
      const presentation = resolveVerifyErrorPresentation(error);
      const pending = presentation.pending;
      if (pending) {
        setPendingRegistration(pending);
      }
      setFieldErrors((current) => ({ ...current, ...presentation.fieldErrors }));
      setStatusMessage(presentation.statusMessage);
      setStatusTone(presentation.statusTone);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingVerification?.verificationId || countdown > 0) return;
    setStatusMessage("");
    setStatusTone("neutral");
    setIsResending(true);
    try {
      const result = await resendClientRegistrationOtp(pendingVerification.verificationId);
      const pending = result?.data?.pendingRegistration || null;
      if (pending) {
        setPendingRegistration(pending);
      }
      setStatusMessage(result?.message || "A new verification code was sent.");
      setStatusTone("success");
    } catch (error) {
      const pending = error?.response?.data?.data?.pending || null;
      if (pending) {
        setPendingRegistration(pending);
      }
      setStatusMessage(
        error?.response?.data?.message || "We could not send a new code right now."
      );
      setStatusTone("error");
    } finally {
      setIsResending(false);
    }
  };

  const resetRegistration = () => {
    writePendingRegistration(null);
    setPendingRegistration(null);
    setVerificationCode("");
    setFieldErrors({});
    setStatusMessage("");
    setStatusTone("neutral");
    startedAtRef.current = Date.now();
  };

  const messageToneClasses =
    statusTone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusTone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : statusTone === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">
        {currentStep === "verify" ? "Verify your account" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {currentStep === "verify"
          ? `Enter the code sent to ${pendingVerification?.destinationMasked || "your email"}.`
          : "Create a client account with verified contact details before you sign in."}
      </p>

      {statusMessage ? (
        <div className={`mt-4 rounded-lg border px-3 py-2 text-sm ${messageToneClasses}`}>
          {statusMessage}
        </div>
      ) : null}

      {currentStep === "register" ? (
        <form onSubmit={handleRegisterSubmit} className="mt-6 space-y-4">
          <div className="hidden" aria-hidden="true">
            <label htmlFor="register-company">Company</label>
            <input
              id="register-company"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.honeypot}
              onChange={(event) => setField("honeypot", event.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Full name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Your full name"
              required
            />
            {firstFieldError(fieldErrors, "name") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "name")}</p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="you@email.com"
              required
            />
            {firstFieldError(fieldErrors, "email") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "email")}</p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              WhatsApp / phone number
            </label>
            <input
              type="tel"
              value={form.phoneNumber}
              onChange={(event) => setField("phoneNumber", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="+62 812 3456 7890"
              required
            />
            {firstFieldError(fieldErrors, "phoneNumber") ? (
              <p className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "phoneNumber")}
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                Use an active number for account recovery and future order updates.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="••••••••"
              minLength={8}
              required
            />
            <p className="mt-2 text-xs text-slate-500">{passwordHint}</p>
            {firstFieldError(fieldErrors, "password") ? (
              <p className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "password")}
              </p>
            ) : null}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Confirm password
            </label>
            <input
              type="password"
              value={form.passwordConfirm}
              onChange={(event) => setField("passwordConfirm", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Repeat your password"
              minLength={8}
              required
            />
            {firstFieldError(fieldErrors, "passwordConfirm") ? (
              <p className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "passwordConfirm")}
              </p>
            ) : null}
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={form.termsAccepted}
              onChange={(event) => setField("termsAccepted", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              required
            />
            <span>
              I agree to the{" "}
              <Link to="/terms" className="font-semibold text-slate-900 hover:underline">
                terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="font-semibold text-slate-900 hover:underline">
                privacy policy
              </Link>
              .
            </span>
          </label>
          {firstFieldError(fieldErrors, "termsAccepted") ? (
            <p className="text-xs text-rose-600">{firstFieldError(fieldErrors, "termsAccepted")}</p>
          ) : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Continue to verification"}
          </button>

          {socialButtons.length > 0 ? (
            <div className="space-y-2 pt-1">
              <div className="text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
                Or continue with
              </div>
              <div className="grid gap-2">
                {socialButtons.map((button) => (
                  <button
                    key={button.id}
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {button.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </form>
      ) : (
        <form onSubmit={handleVerifySubmit} className="mt-6 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <p className="font-medium text-slate-900">Registration pending verification</p>
            <p className="mt-1">Channel: {pendingVerification?.channel || "EMAIL"}</p>
            {deliveryFailed ? (
              <p className="mt-1 text-amber-700">
                We could not deliver the latest verification code. Wait for resend to become
                available, then request a new code.
              </p>
            ) : (
              <p className="mt-1">
                Code expires in {pendingVerification?.expiresInSeconds || 0} seconds.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Verification code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={verificationCode}
              onChange={(event) =>
                setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm tracking-[0.35em]"
              placeholder="123456"
              required
            />
            {firstFieldError(fieldErrors, "otpCode") ? (
              <p className="mt-2 text-xs text-rose-600">{firstFieldError(fieldErrors, "otpCode")}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">
                {deliveryFailed
                  ? "Verification stays locked until a code is delivered successfully."
                  : "We only activate your account after this code is verified."}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={isVerifying || !canSubmitOtp}
            className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isVerifying
              ? "Verifying..."
              : canSubmitOtp
                ? "Verify and activate account"
                : "Wait for a new verification code"}
          </button>
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={isResending || countdown > 0}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {isResending
              ? "Sending new code..."
              : countdown > 0
                ? `Resend code in ${countdown}s`
                : "Resend verification code"}
          </button>
          <button
            type="button"
            onClick={resetRegistration}
            className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            Start over
          </button>
        </form>
      )}

      <p className="mt-4 text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/auth/login" className="font-semibold text-slate-900 hover:underline">
          Sign in
        </Link>
      </p>
    </section>
  );
}
