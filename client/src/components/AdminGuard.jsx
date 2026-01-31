import { useEffect, useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth.js";

const fetchMe = async () => {
  const res = await fetch("/api/auth/me");
  if (!res.ok) {
    throw new Error("Failed to fetch me");
  }
  return res.json();
};

export default function AdminGuard() {
  const location = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
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
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking admin session...
      </div>
    );
  }

  if (meQuery.isError) {
    const status = meQuery.error?.response?.status;
    if (status === 401 || status === 403) {
      return <Navigate to="/admin/login" replace state={{ from: location }} />;
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
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const role = String(me?.role || "").toLowerCase();
  const isAdmin = ["admin", "super_admin", "superadmin", "staff"].includes(role);

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet context={{ user: me }} />;
}
