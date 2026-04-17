import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAccountAuth } from "../auth/authDomainHooks.js";
import {
  ACCOUNT_LOGIN_REQUIRED_NOTICE,
  buildLoginRedirectState,
} from "../auth/loginRedirectState.ts";

export default function AccountGuard() {
  const location = useLocation();
  const { user, isLoading, isAccountSession } = useAccountAuth();
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Checking session...
      </div>
    );
  }

  if (!isAccountSession || !user) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={buildLoginRedirectState({
          from: location,
          authNotice: ACCOUNT_LOGIN_REQUIRED_NOTICE,
        })}
      />
    );
  }

  return <Outlet context={{ user }} />;
}
