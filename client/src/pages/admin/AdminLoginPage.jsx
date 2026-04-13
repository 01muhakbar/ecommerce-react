import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAdminAuth } from "../../auth/authDomainHooks.js";
import { clearPendingAuthNotice, readPendingAuthNotice } from "../../auth/authSessionNotice.js";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import adminLoginHero from "../../assets/admin-login-hero.jpg";
import useStoreBranding from "../../hooks/useStoreBranding.js";
import { resolveAssetUrl } from "../../lib/assetUrl.js";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { login } = useAdminAuth();
  const { branding } = useStoreBranding();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const noticeRef = useRef(null);
  const errorRef = useRef(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await login(email, password);
      if (!result?.ok) {
        const nextError = new Error(result?.message || "Login failed.");
        nextError.code = result?.code || "";
        nextError.status = result?.status || null;
        throw nextError;
      }
      return result;
    },
    onSuccess: async () => {
      toast.success("Login Success!", {
        id: "admin-login-success",
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "me"], exact: true });
      navigate("/admin", { replace: true });
    },
    onError: (error) => {
      // Intentionally silent; UI shows error message.
    },
  });

  useEffect(() => {
    const nextNotice = String(location.state?.authNotice || readPendingAuthNotice() || "").trim();
    if (nextNotice) {
      setAuthNotice(nextNotice);
      clearPendingAuthNotice();
    }
  }, [location.state]);

  useEffect(() => {
    if (authNotice && noticeRef.current) {
      noticeRef.current.focus();
    }
  }, [authNotice]);

  useEffect(() => {
    if (mutation.isError && errorRef.current) {
      errorRef.current.focus();
    }
  }, [mutation.isError]);

  const handleSubmit = (event) => {
    event.preventDefault();
    mutation.mutate();
  };

  const errorMsg =
    mutation.error?.response?.data?.message ||
    mutation.error?.message ||
    "Login failed. Check your credentials.";
  const heroSrc = resolveAssetUrl(branding?.adminLoginHeroUrl) || adminLoginHero;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-4">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative min-h-[220px] bg-slate-200 sm:min-h-[300px] lg:min-h-[560px]">
            <img
              src={heroSrc}
              alt="Admin workspace dashboard preview"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.45)_100%)]" />
          </div>

          <div className="flex items-center bg-white">
            <div className="w-full px-6 py-7 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
              <div className="mx-auto max-w-md">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
                  Secure Access
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Admin Login
                </h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sign in to access Admin Workspace.
                </p>

                <AuthNotice
                  id="admin-login-notice"
                  tone="warning"
                  focusRef={noticeRef}
                  className="mt-4 rounded-2xl text-xs"
                >
                  {authNotice}
                </AuthNotice>

                <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
                  <div>
                    <label
                      htmlFor="admin-login-email"
                      className="text-sm font-medium text-slate-700"
                    >
                      Email
                    </label>
                    <input
                      id="admin-login-email"
                      ref={emailRef}
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                      placeholder="admin@local"
                      autoComplete="email"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="admin-login-password"
                        className="text-sm font-medium text-slate-700"
                      >
                        Password
                      </label>
                      <Link
                        to="/admin/forgot-password"
                        className="text-sm font-medium text-teal-700 transition hover:text-teal-800 hover:underline"
                      >
                        Forgot your password
                      </Link>
                    </div>
                    <div className="relative mt-2">
                      <input
                        id="admin-login-password"
                        ref={passwordRef}
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-14 text-sm text-slate-900 transition placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-teal-500/10"
                        placeholder="••••••••"
                        autoComplete="current-password"
                      />
                      <PasswordVisibilityButton
                        visible={showPassword}
                        onToggle={() => setShowPassword((prev) => !prev)}
                      />
                    </div>
                  </div>

                  <AuthNotice
                    id="admin-login-error"
                    tone="error"
                    live="assertive"
                    focusRef={errorRef}
                    className="rounded-2xl text-xs"
                  >
                    {mutation.isError ? errorMsg : ""}
                  </AuthNotice>

                  {mutation.isError && mutation.error?.code === "VERIFICATION_REQUIRED" ? (
                    <p className="text-xs leading-6 text-slate-500">
                      Need another verification email?{" "}
                      <Link
                        to={`/admin/resend-verification?email=${encodeURIComponent(email)}`}
                        className="font-semibold text-teal-700 hover:underline"
                      >
                        Resend verification
                      </Link>
                    </p>
                  ) : null}
                  {mutation.isError && mutation.error?.code === "APPROVAL_REQUIRED" ? (
                    <p className="text-xs leading-6 text-slate-500">
                      Your email is verified. Wait for Admin Workspace approval before signing in.
                    </p>
                  ) : null}
                  {mutation.isError && mutation.error?.code === "ACCOUNT_INACTIVE" ? (
                    <p className="text-xs leading-6 text-slate-500">
                      This account is inactive. Contact Admin Workspace if you need sign-in access
                      restored.
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="w-full rounded-2xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-teal-500/70"
                  >
                    {mutation.isPending ? "Signing in..." : "Login"}
                  </button>
                </form>

                <div className="mt-5 border-t border-slate-200 pt-4">
                  <p className="text-sm text-slate-500">
                    Need a Staff account?{" "}
                    <Link
                      to="/admin/create-account"
                      className="font-semibold text-teal-700 transition hover:text-teal-800 hover:underline"
                    >
                      Create account
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
