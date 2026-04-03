import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAdminAuth } from "../../auth/authDomainHooks.js";
import { clearPendingAuthNotice, readPendingAuthNotice } from "../../auth/authSessionNotice.js";
import AuthNotice from "../../components/auth/AuthNotice.jsx";
import PasswordVisibilityButton from "../../components/auth/PasswordVisibilityButton.jsx";
import { PASSWORD_HIDDEN_HELPER } from "../../utils/authUi.js";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { login } = useAdminAuth();
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold">Admin Login</h1>
        <p className="mt-2 text-sm text-slate-500">Sign in to access Admin Workspace.</p>
        <AuthNotice
          id="admin-login-notice"
          tone="warning"
          focusRef={noticeRef}
          className="mt-4 rounded-xl text-xs"
        >
          {authNotice}
        </AuthNotice>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-login-email" className="text-sm font-medium text-slate-600">
              Email
            </label>
            <input
              id="admin-login-email"
              ref={emailRef}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
              placeholder="admin@local"
            />
          </div>
          <div>
            <label htmlFor="admin-login-password" className="text-sm font-medium text-slate-600">
              Password
            </label>
            <div className="relative mt-2">
              <input
                id="admin-login-password"
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-4 py-2 pr-14 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <PasswordVisibilityButton
                visible={showPassword}
                onToggle={() => setShowPassword((prev) => !prev)}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500">{PASSWORD_HIDDEN_HELPER}</span>
              <Link
                to="/admin/forgot-password"
                className="text-xs font-semibold text-slate-900 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <AuthNotice
            id="admin-login-error"
            tone="error"
            live="assertive"
            focusRef={errorRef}
            className="rounded-xl text-xs"
          >
            {mutation.isError ? errorMsg : ""}
          </AuthNotice>
          {mutation.isError && mutation.error?.code === "VERIFICATION_REQUIRED" ? (
            <p className="text-xs text-slate-500">
              Need another verification email?{" "}
              <Link
                to={`/admin/resend-verification?email=${encodeURIComponent(email)}`}
                className="font-semibold text-slate-900 hover:underline"
              >
                Resend verification
              </Link>
            </p>
          ) : null}
          {mutation.isError && mutation.error?.code === "APPROVAL_REQUIRED" ? (
            <p className="text-xs text-slate-500">
              Your email is verified. Wait for Admin Workspace approval before signing in.
            </p>
          ) : null}
          {mutation.isError && mutation.error?.code === "ACCOUNT_INACTIVE" ? (
            <p className="text-xs text-slate-500">
              This account is inactive. Contact Admin Workspace if you need sign-in access restored.
            </p>
          ) : null}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {mutation.isPending ? "Signing in..." : "Login"}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-500">
          Need a Staff account?{" "}
          <Link
            to="/admin/create-account"
            className="font-semibold text-slate-900 hover:underline"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
