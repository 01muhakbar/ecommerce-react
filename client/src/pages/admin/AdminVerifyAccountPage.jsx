import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyAdminStaffAccount } from "../../api/adminPublicAuth.ts";
import AuthNotice from "../../components/auth/AuthNotice.jsx";

export default function AdminVerifyAccountPage() {
  const [searchParams] = useSearchParams();
  const statusRef = useRef(null);
  const requestCacheRef = useRef(new Map());
  const token = String(searchParams.get("token") || "").trim();
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState("neutral");
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!token) {
        setStatusMessage(
          "This verification link is incomplete or invalid. Create a new Staff account to receive another email."
        );
        setStatusTone("error");
        setIsVerifying(false);
        return;
      }

      try {
        let request = requestCacheRef.current.get(token);
        if (!request) {
          request = verifyAdminStaffAccount(token);
          requestCacheRef.current.set(token, request);
        }
        const result = await request;
        if (cancelled) return;
        setStatusMessage(
          result?.message ||
            "Email verified. Your Staff account is now waiting for Admin Workspace approval before you can sign in."
        );
        setStatusTone("warning");
      } catch (error) {
        if (cancelled) return;
        setStatusMessage(
          error?.response?.data?.message ||
            "This verification link is invalid or has expired. Create a new Staff account or request another verification email."
        );
        setStatusTone("error");
      } finally {
        if (!cancelled) {
          setIsVerifying(false);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Verify Staff Account</h1>
        <p className="mt-2 text-sm text-slate-500">
          We only activate Admin Workspace Staff accounts after the verification email is completed and an Admin Workspace reviewer approves access.
        </p>

        <AuthNotice
          id="admin-verify-account-status"
          tone={statusTone}
          live={statusTone === "error" ? "assertive" : "polite"}
          focusRef={statusRef}
          className="mt-4"
        >
          {isVerifying ? "Verifying your email..." : statusMessage}
        </AuthNotice>

        <div className="mt-6 space-y-2 text-sm text-slate-500">
          <p>
            <Link to="/admin/login" className="font-semibold text-slate-900 hover:underline">
              Back to admin login
            </Link>
          </p>
          <p>
            <Link to="/admin/resend-verification" className="font-semibold text-slate-900 hover:underline">
              Resend verification email
            </Link>
          </p>
          <p>
            <Link to="/admin/create-account" className="font-semibold text-slate-900 hover:underline">
              Create another Staff account
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
