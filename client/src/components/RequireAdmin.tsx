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
    if (import.meta.env.DEV) {
      console.warn("[RequireAdmin] Forbidden for role:", user.role);
    }
    // Redirect non-admin users away from admin routes
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: loc, reason: "forbidden" }}
      />
    );
  }
  return <>{children}</>;
}
