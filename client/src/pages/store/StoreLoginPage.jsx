import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useAccountAuth } from "../../auth/authDomainHooks.js";
import { api } from "../../api/axios.ts";
import { useCart } from "../../hooks/useCart.ts";
import * as cartApi from "../../api/cartApi.ts";
import { clearGuestCart, getGuestCart } from "../../utils/guestCart.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import { getRetryAfterSeconds } from "../../utils/authRateLimit.js";
import { clearPendingAuthNotice, readPendingAuthNotice } from "../../auth/authSessionNotice.js";
import {
  PASSWORD_HIDDEN_HELPER,
  buildCooldownButtonLabel,
  buildRetryAfterMessage,
} from "../../utils/authUi.js";

const PENDING_ADD_KEY = "pending_cart_add";
const PENDING_ADD_CONSUMED_KEY = "pending_cart_add_consumed";

export default function StoreLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeSettings } = useOutletContext() || {};
  const { refreshSession, isAuthenticated } = useAccountAuth();
  const { refreshCart } = useCart();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const statusRef = useRef(null);
  const errorRef = useRef(null);
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

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/account", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    const nextMessage = String(
      location.state?.authNotice || location.state?.passwordResetMessage || readPendingAuthNotice() || ""
    ).trim();
    if (nextMessage) {
      setStatusMessage(nextMessage);
      clearPendingAuthNotice();
    }
  }, [location.state]);

  useEffect(() => {
    if (cooldownSeconds <= 0) return undefined;
    const timer = window.setTimeout(() => {
      setCooldownSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [cooldownSeconds]);

  useEffect(() => {
    if (error && errorRef.current) {
      errorRef.current.focus();
    }
  }, [error]);

  useEffect(() => {
    if (statusMessage && statusRef.current) {
      statusRef.current.focus();
    }
  }, [statusMessage]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");
    setIsSubmitting(true);
    try {
      const response = await api.post(
        "/auth/login",
        { email, password },
        { withCredentials: true }
      );
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
            console.warn("[store-login] guest cart merge failed", mergeError);
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
            console.warn("[store-login] pending add merge failed", mergeError);
          }
          return null;
        }
      };
      if (import.meta.env.DEV) {
        console.log("[store-login] login ok", {
          url: "/api/auth/login",
          status: response?.status,
        });
        console.log("[store-login] document.cookie", document.cookie);
        fetch("/api/auth/me", { credentials: "include" })
          .then((res) =>
            console.log("[store-login] me status", res.status)
          )
          .catch((err) =>
            console.log("[store-login] me status error", err)
          );
      }
      await mergeGuestCart();
      const pendingFrom = await mergePendingAdd();
      await refreshSession();
      await refreshCart(false);
      // Redirect back to intended page if present; avoid looping to login.
      const fromState = location.state?.from;
      const resolvedFrom =
        typeof fromState === "string"
          ? fromState
          : fromState && fromState.pathname
            ? `${fromState.pathname || ""}${fromState.search || ""}${fromState.hash || ""}`
            : null;
      const target =
        pendingFrom && pendingFrom !== "/auth/login"
          ? pendingFrom
          : resolvedFrom && resolvedFrom !== "/auth/login"
            ? resolvedFrom
            : "/account";
      navigate(target, { replace: true });
    } catch (err) {
      if (err?.response?.status === 403 && err?.response?.data?.code === "VERIFICATION_REQUIRED") {
        const pendingRegistration = err?.response?.data?.data?.pending || null;
        navigate("/auth/register", {
          replace: true,
          state: {
            pendingRegistration,
            pendingNotice:
              err?.response?.data?.message || "Verify your email before signing in.",
          },
        });
        return;
      }
      setError(
        err?.response?.status === 429 && getRetryAfterSeconds(err) > 0
          ? buildRetryAfterMessage(getRetryAfterSeconds(err))
          : err?.response?.data?.message ||
              "We couldn't sign you in. Check your email and password and try again."
      );
      const retryAfterSeconds = getRetryAfterSeconds(err);
      if (retryAfterSeconds > 0) {
        setCooldownSeconds(retryAfterSeconds);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to access your account.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="store-login-email" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Email
          </label>
          <input
            id="store-login-email"
            ref={emailRef}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="you@email.com"
            autoComplete="email"
            required
          />
        </div>
        <div>
          <label htmlFor="store-login-password" className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Password
          </label>
          <div className="relative mt-2">
            <input
              id="store-login-password"
              ref={passwordRef}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 pr-16 text-sm"
              placeholder="••••••••"
              autoComplete="current-password"
              aria-describedby="store-login-password-helper"
              required
            />
            <PasswordVisibilityButton
              visible={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span id="store-login-password-helper" className="text-xs text-slate-500">
              {PASSWORD_HIDDEN_HELPER}
            </span>
            <Link to="/auth/forgot-password" className="text-xs font-semibold text-slate-900 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        <AuthNotice id="store-login-status" tone="success" focusRef={statusRef}>
          {statusMessage}
        </AuthNotice>
        <AuthNotice id="store-login-error" tone="error" live="assertive" focusRef={errorRef}>
          {error}
        </AuthNotice>
        <button
          type="submit"
          disabled={isSubmitting || cooldownSeconds > 0}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting
            ? "Signing in..."
            : buildCooldownButtonLabel(cooldownSeconds, "Sign in")}
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
      <p className="mt-4 text-sm text-slate-500">
        New here?{" "}
        <Link to="/auth/register" className="font-semibold text-slate-900 hover:underline">
          Create account
        </Link>
      </p>
    </section>
  );
}
