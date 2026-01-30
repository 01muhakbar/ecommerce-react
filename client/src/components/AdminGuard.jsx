import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/axios.ts";
import { useAuth } from "../auth/useAuth.js";

const fetchMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export default function AdminGuard() {
  const location = useLocation();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: fetchMe,
    retry: false,
    enabled: !authLoading && isAuthenticated,
  });

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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking admin session...
      </div>
    );
  }

  if (isError) {
    const status = error?.response?.status;
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

  const user = data?.data?.user;
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = ["admin", "super_admin", "superadmin", "staff"].includes(role);

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return <Outlet context={{ user }} />;
}
