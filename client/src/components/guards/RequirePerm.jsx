import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/useAuth.js";
import { can } from "../../constants/permissions.js";

export default function RequirePerm({ perm, children }) {
  const location = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking access...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  if (!can(user, perm)) {
    return <Navigate to="/admin/forbidden" replace state={{ from: location }} />;
  }

  return children;
}
