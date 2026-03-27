import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../auth/authDomainHooks.js";

// Legacy admin-oriented guard. Keep for compatibility until old admin routes are fully sunset.
export default function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth();

  if (isLoading) {
    return <div style={{ padding: "24px" }}>Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
