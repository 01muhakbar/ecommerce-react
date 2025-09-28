import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { api } from "@/api/axios";

export default function RequireAdmin({ children }: { children?: JSX.Element }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => (await api.get("/auth/me")).data, // ← harus {id,email,role,...}
    retry: false,
    staleTime: 60_000,
  });

  console.log("RequireAdmin:", { isLoading, isError, data });

  if (isLoading) return <div className="p-6 text-center">Authenticating...</div>;
  if (isError || !data?.id) return <Navigate to="/admin/login" replace />;

  // Lolos: render anak atau Outlet
  return children ?? <Outlet />;
}
