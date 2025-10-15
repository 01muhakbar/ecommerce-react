import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { isAdminRole } from "@/utils/role";

export default function RequireAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuthStore.getState();
  const loc = useLocation();

  if (loading) return null;
  if (!user)
    return <Navigate to="/admin/login" replace state={{ from: loc }} />;

  if (!isAdminRole(user.role)) {
    // Bisa tampilkan detail saat DEV untuk debug cepat
    if (import.meta.env.DEV) {
      console.warn("[RequireAdmin] Forbidden for role:", user.role);
    }
    return <div className="p-6">Akses ditolak.</div>;
  }
  return <>{children}</>;
}
