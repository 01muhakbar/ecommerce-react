import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/useAuth.js";

export default function RoleRoute({ allowedRoles = [] }) {
  const { isAuthenticated, isLoading, role } = useAuth();

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
