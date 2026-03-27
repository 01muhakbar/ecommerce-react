import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { useAccountAuth } from "../../auth/authDomainHooks.js";
import { api } from "../../api/axios.ts";
import { useCart } from "../../hooks/useCart.ts";
import * as cartApi from "../../api/cartApi.ts";
import { clearGuestCart, getGuestCart } from "../../utils/guestCart.ts";

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
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
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
      setError("Login failed. Please check your credentials.");
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
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="you@email.com"
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="••••••••"
            required
          />
        </div>
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
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
