import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";

type Props = { allowedRoles?: string[]; children: JSX.Element };

export default function RequireAdmin({
  allowedRoles = ["Admin", "Super Admin"],
  children,
}: Props) {
  const { isAuthenticated, user, loading } = useAuthStore();

  console.log("RequireAdmin checking auth state:", { isAuthenticated, user, loading });

  if (loading) {
    return <div className="p-8">Checking session…</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}