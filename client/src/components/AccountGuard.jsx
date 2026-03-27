import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccountAuth } from "../auth/authDomainHooks.js";

export default function AccountGuard() {
  const location = useLocation();
  const { user, isLoading, isAuthenticated } = useAccountAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking session...
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <Outlet context={{ user }} />;
}
