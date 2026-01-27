import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/axios.ts";

const fetchMe = async () => {
  const { data } = await api.get("/auth/me");
  return data;
};

export default function AdminGuard() {
  const location = useLocation();
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["admin", "me"],
    queryFn: fetchMe,
    retry: false,
  });

  const status = error?.response?.status;
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking session...
      </div>
    );
  }

  if (isError && status === 401) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-rose-600">
        Failed to load admin session.
      </div>
    );
  }

  return <Outlet context={{ user: data?.data?.user }} />;
}