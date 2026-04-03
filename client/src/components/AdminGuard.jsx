import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAdminAuth } from "../auth/authDomainHooks.js";
import {
  readPendingAuthNotice,
  resolveUnauthorizedNotice,
} from "../auth/authSessionNotice.js";

const fetchMe = async () => {
  const res = await fetch("/api/auth/me");
  if (!res.ok) {
    const error = new Error("Failed to fetch me");
    error.status = res.status;
    throw error;
  }
  return res.json();
};

export default function AdminGuard() {
  const location = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAdminAuth();
  const meQuery = useQuery({
    queryKey: ["admin", "me"],
    queryFn: fetchMe,
    retry: false,
    enabled: !authLoading && isAuthenticated,
  });

  const me =
    meQuery.data?.data?.user ??
    meQuery.data?.user ??
    meQuery.data?.data ??
    null;

  const didLog = useRef(false);
  useEffect(() => {
    if (!import.meta.env.DEV || didLog.current) return;
    didLog.current = true;
    // Debug guard state during refresh.
    console.log("[admin-guard] status", {
      isLoading: meQuery.isLoading,
      isFetching: meQuery.isFetching,
      hasMe: Boolean(me),
      data: meQuery.data,
    });
  }, [meQuery.isLoading, meQuery.isFetching, meQuery.data, me]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking admin session...
      </div>
    );
  }

  if (!isAuthenticated) {
    const authNotice = readPendingAuthNotice();
    return <Navigate to="/admin/login" replace state={{ from: location, authNotice }} />;
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking admin session...
      </div>
    );
  }

  if (meQuery.isError) {
    const status = Number(meQuery.error?.response?.status || meQuery.error?.status || 0);
    if (status === 401 || status === 403) {
      const authNotice =
        readPendingAuthNotice() ||
        resolveUnauthorizedNotice({ status });
      return <Navigate to="/admin/login" replace state={{ from: location, authNotice }} />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-slate-600">
        <p>API unreachable or server error{status ? ` (status ${status})` : ""}.</p>
        <a
          href="/admin/login"
          className="rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:border-slate-300"
        >
          Back to login
        </a>
      </div>
    );
  }

  if (!me) {
    const authNotice = readPendingAuthNotice();
    return <Navigate to="/admin/login" replace state={{ from: location, authNotice }} />;
  }

  const role = String(me?.role || "").toLowerCase();
  const isAdmin = ["admin", "super_admin", "superadmin", "staff"].includes(role);

  if (!isAdmin) {
    const authNotice = readPendingAuthNotice();
    return <Navigate to="/admin/login" replace state={{ from: location, authNotice }} />;
  }

  return <Outlet context={{ user: me }} />;
}
