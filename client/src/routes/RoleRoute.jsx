import { Navigate, Outlet } from "react-router-dom";
import { useAdminAuth } from "../auth/authDomainHooks.js";

// Legacy admin-oriented role guard. Do not reuse for seller/account routes.
export default function RoleRoute({ allowedRoles = [] }) {
  const { isAuthenticated, isLoading, role } = useAdminAuth();

  if (isLoading) {
    return <div style={{ padding: "24px" }}>Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
