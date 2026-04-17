import { useEffect, useRef, useState } from "react";
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
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import PasswordStrengthIndicator from "../../components/auth/PasswordStrengthIndicator.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import {
  PASSWORD_CONFIRM_HELPER,
  buildCooldownButtonLabel,
  buildResendCooldownMessage,
} from "../../utils/authUi.js";

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

export default function StoreRegisterPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeSettings } = useOutletContext() || {};
  const { refreshSession, isAccountSession } = useAccountAuth();
  const { refreshCart } = useCart();
  const startedAtRef = useRef(Date.now());
  const statusRef = useRef(null);
  const fieldRefs = useRef({
    name: null,
    email: null,
    phoneNumber: null,
    password: null,
    passwordConfirm: null,
    otpCode: null,
    termsAccepted: null,
  });
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
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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
  const pendingVerification = pendingRegistration?.verification || null;
  const canSubmitOtp = pendingVerification?.canSubmitOtp !== false;
  const deliveryFailed = pendingVerification?.deliveryStatus === "FAILED";

  useEffect(() => {
    if (isAccountSession) {
      navigate("/account", { replace: true });
    }
  }, [isAccountSession, navigate]);

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

  const mergeGuestCart = async () => {
    try {
      const guest = getGuestCart();
      const items = Array.isArray(guest?.items) ? guest.items : [];
      if (items.length === 0) return;
      for (const item of items) {
        const id = Number(item?.productId);
        const qty = Math.max(1, Number(item?.qty) || 1);
        if (!Number.isFinite(id) || id <= 0) continue;
        await cartApi.addToCart(id, qty, {
          variantKey: item?.variantKey ?? null,
          variantSelections: Array.isArray(item?.variantSelections) ? item.variantSelections : [],
        });
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
        await cartApi.addToCart(id, qty, parsed?.snapshot || undefined);
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
      const retryAfterSeconds = getRetryAfterSeconds(error);
      if (retryAfterSeconds > 0) {
        setCountdown((current) => Math.max(current, retryAfterSeconds));
      }
      setStatusMessage(
        error?.response?.status === 429 && retryAfterSeconds > 0
          ? buildResendCooldownMessage(retryAfterSeconds)
          : error?.response?.data?.message || "We could not send a new code right now."
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

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">
        {currentStep === "verify" ? "Verify your account" : "Create your account"}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {currentStep === "verify"
          ? `Enter the 6-digit code sent to ${pendingVerification?.destinationMasked || "your email"}.`
          : "Create your client account. We only activate it after your email is verified."}
      </p>

      <AuthNotice
        id="store-register-status"
        tone={statusTone}
        live={statusTone === "error" ? "assertive" : "polite"}
        focusRef={statusRef}
        className="mt-4"
      >
        {statusMessage}
      </AuthNotice>

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
            <label htmlFor="store-register-name" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Full name
            </label>
            <input
              id="store-register-name"
              ref={(node) => {
                fieldRefs.current.name = node;
              }}
              type="text"
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Your full name"
              aria-invalid={Boolean(firstFieldError(fieldErrors, "name"))}
              aria-describedby={firstFieldError(fieldErrors, "name") ? "store-register-name-error" : undefined}
              required
            />
            {firstFieldError(fieldErrors, "name") ? (
              <p id="store-register-name-error" className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "name")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="store-register-email" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Email
            </label>
            <input
              id="store-register-email"
              ref={(node) => {
                fieldRefs.current.email = node;
              }}
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="you@email.com"
              autoComplete="email"
              aria-invalid={Boolean(firstFieldError(fieldErrors, "email"))}
              aria-describedby={firstFieldError(fieldErrors, "email") ? "store-register-email-error" : undefined}
              required
            />
            {firstFieldError(fieldErrors, "email") ? (
              <p id="store-register-email-error" className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "email")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="store-register-phone" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              WhatsApp / phone number
            </label>
            <input
              id="store-register-phone"
              ref={(node) => {
                fieldRefs.current.phoneNumber = node;
              }}
              type="tel"
              value={form.phoneNumber}
              onChange={(event) => setField("phoneNumber", event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="+62 812 3456 7890"
              autoComplete="tel"
              aria-invalid={Boolean(firstFieldError(fieldErrors, "phoneNumber"))}
              aria-describedby={
                firstFieldError(fieldErrors, "phoneNumber")
                  ? "store-register-phone-error"
                  : "store-register-phone-helper"
              }
              required
            />
            {firstFieldError(fieldErrors, "phoneNumber") ? (
              <p id="store-register-phone-error" className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "phoneNumber")}
              </p>
            ) : (
              <p id="store-register-phone-helper" className="mt-2 text-xs text-slate-500">
                Use an active number for account recovery and future order updates.
              </p>
            )}
          </div>
          <div>
            <label htmlFor="store-register-password" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="store-register-password"
                ref={(node) => {
                  fieldRefs.current.password = node;
                }}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-16 text-sm"
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={8}
                aria-invalid={Boolean(firstFieldError(fieldErrors, "password"))}
                aria-describedby={firstFieldError(fieldErrors, "password") ? "store-register-password-error" : undefined}
                required
              />
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((value) => !value)}
              />
            </div>
            <PasswordStrengthIndicator password={form.password} />
            {firstFieldError(fieldErrors, "password") ? (
              <p id="store-register-password-error" className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "password")}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="store-register-password-confirm" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Confirm password
            </label>
            <div className="relative mt-2">
              <input
                id="store-register-password-confirm"
                ref={(node) => {
                  fieldRefs.current.passwordConfirm = node;
                }}
                type={showPasswordConfirm ? "text" : "password"}
                value={form.passwordConfirm}
                onChange={(event) => setField("passwordConfirm", event.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-16 text-sm"
                placeholder="Repeat your password"
                autoComplete="new-password"
                minLength={8}
                aria-invalid={Boolean(firstFieldError(fieldErrors, "passwordConfirm"))}
                aria-describedby={
                  firstFieldError(fieldErrors, "passwordConfirm")
                    ? "store-register-password-confirm-error"
                    : "store-register-password-confirm-helper"
                }
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
              <p id="store-register-password-confirm-error" className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "passwordConfirm")}
              </p>
            ) : (
              <p id="store-register-password-confirm-helper" className="mt-2 text-xs text-slate-500">
                {PASSWORD_CONFIRM_HELPER}
              </p>
            )}
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 px-3 py-3 text-sm text-slate-600">
            <input
              ref={(node) => {
                fieldRefs.current.termsAccepted = node;
              }}
              type="checkbox"
              checked={form.termsAccepted}
              onChange={(event) => setField("termsAccepted", event.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300"
              aria-invalid={Boolean(firstFieldError(fieldErrors, "termsAccepted"))}
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
            <label htmlFor="store-register-otp" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Verification code
            </label>
            <input
              id="store-register-otp"
              ref={(node) => {
                fieldRefs.current.otpCode = node;
              }}
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
              aria-invalid={Boolean(firstFieldError(fieldErrors, "otpCode"))}
              aria-describedby={
                firstFieldError(fieldErrors, "otpCode")
                  ? "store-register-otp-error"
                  : "store-register-otp-helper"
              }
              required
            />
            {firstFieldError(fieldErrors, "otpCode") ? (
              <p id="store-register-otp-error" className="mt-2 text-xs text-rose-600">
                {firstFieldError(fieldErrors, "otpCode")}
              </p>
            ) : (
              <p id="store-register-otp-helper" className="mt-2 text-xs text-slate-500">
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
              : buildCooldownButtonLabel(countdown, "Resend verification code", "Resend code in")}
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
