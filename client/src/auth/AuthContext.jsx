import { createContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  accountLogout as accountLogoutRequest,
  accountMe as accountMeRequest,
  adminLogin as adminLoginRequest,
  adminLogout as adminLogoutRequest,
  adminMe as adminMeRequest,
} from "../api/auth.service.js";
import { api } from "../api/axios.ts";
import { onUnauthorized } from "./authEvents.ts";
import { useQueryClient } from "@tanstack/react-query";
import { useBuyerCartSessionSync } from "./useBuyerCartSessionSync.js";
import {
  DEFAULT_SESSION_EXPIRED_NOTICE,
  resolveUnauthorizedNotice,
  storePendingAuthNotice,
} from "./authSessionNotice.js";

export const AuthContext = createContext(null);

const ADMIN_ROUTE_PREFIX = "/admin";
const ACCOUNT_SESSION_KEY = "accountSessionHint";
const ADMIN_SESSION_KEY = "adminSessionHint";
const LEGACY_ACCOUNT_SESSION_KEY = "authSessionHint";

const getScopeStorageKey = (scope) =>
  scope === "admin" ? ADMIN_SESSION_KEY : ACCOUNT_SESSION_KEY;

const readAuthHint = (scope) => {
  try {
    const keys = [getScopeStorageKey(scope)];
    if (!keys.includes(LEGACY_ACCOUNT_SESSION_KEY)) {
      keys.push(LEGACY_ACCOUNT_SESSION_KEY);
    }
    return keys.some((key) => localStorage.getItem(key) === "true");
  } catch {
    return false;
  }
};

const writeAuthHint = (scope, value) => {
  try {
    const key = getScopeStorageKey(scope);
    if (value) {
      localStorage.setItem(key, "true");
      if (scope !== "admin") {
        localStorage.setItem(LEGACY_ACCOUNT_SESSION_KEY, "true");
      }
    } else {
      localStorage.removeItem(key);
      if (scope !== "admin") {
        localStorage.removeItem(LEGACY_ACCOUNT_SESSION_KEY);
      }
    }
  } catch {
    // ignore storage errors
  }
};

const normalizeAuthUser = (response) =>
  response?.data?.user ??
  response?.user ??
  response?.data ??
  (response && response.id ? response : null);

export function AuthProvider({ children }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const currentScope = location.pathname.startsWith(ADMIN_ROUTE_PREFIX) ? "admin" : "account";

  const [accountUser, setAccountUser] = useState(null);
  const [accountRole, setAccountRole] = useState(null);
  const [isAccountLoading, setIsAccountLoading] = useState(true);

  const [adminUser, setAdminUser] = useState(null);
  const [adminRole, setAdminRole] = useState(null);
  const [isAdminLoading, setIsAdminLoading] = useState(true);

  const { resetBuyerCartSessionSync } = useBuyerCartSessionSync({
    user: accountUser,
    role: accountRole,
    isLoading: isAccountLoading,
  });

  const currentUser = currentScope === "admin" ? adminUser : accountUser;
  const currentRole = currentScope === "admin" ? adminRole : accountRole;
  const currentLoading = currentScope === "admin" ? isAdminLoading : isAccountLoading;

  const clearSession = (scope = currentScope) => {
    if (scope === "admin") {
      setAdminUser(null);
      setAdminRole(null);
      setIsAdminLoading(false);
      writeAuthHint("admin", false);
      try {
        localStorage.removeItem("adminAuthToken");
      } catch {
        // ignore storage errors
      }
      return;
    }

    setAccountUser(null);
    setAccountRole(null);
    setIsAccountLoading(false);
    writeAuthHint("account", false);
    try {
      localStorage.removeItem("authToken");
    } catch {
      // ignore storage errors
    }
    delete api.defaults.headers.common.Authorization;
  };

  const refreshSession = async (options = {}, scope = currentScope) => {
    const markExpiredOnUnauthorized = options?.markExpiredOnUnauthorized === true;

    if (scope === "admin") {
      setIsAdminLoading(true);
    } else {
      setIsAccountLoading(true);
    }

    try {
      const response = scope === "admin" ? await adminMeRequest() : await accountMeRequest();
      const nextUser = normalizeAuthUser(response);
      if (!nextUser) {
        if (markExpiredOnUnauthorized) {
          storePendingAuthNotice(DEFAULT_SESSION_EXPIRED_NOTICE);
        }
        clearSession(scope);
        return;
      }

      const nextRole = String(nextUser?.role ?? "").toLowerCase() || null;
      if (scope === "admin") {
        setAdminUser(nextUser);
        setAdminRole(nextRole);
      } else {
        setAccountUser(nextUser);
        setAccountRole(nextRole);
      }
      writeAuthHint(scope, true);

      if (import.meta.env.DEV) {
        console.log("[auth] refreshSession user", { scope, user: nextUser });
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        if (markExpiredOnUnauthorized) {
          storePendingAuthNotice(
            resolveUnauthorizedNotice({
              status,
              code: error?.response?.data?.code,
              message: error?.response?.data?.message,
            })
          );
        }
        clearSession(scope);
        return;
      }
      if (import.meta.env.DEV) {
        console.info("[auth] refreshSession skipped", error);
      }
    } finally {
      if (scope === "admin") {
        setIsAdminLoading(false);
      } else {
        setIsAccountLoading(false);
      }
    }
  };

  const login = async (email, password) => {
    if (!email || !password) {
      return { ok: false, message: "Email and password are required." };
    }

    setIsAdminLoading(true);
    try {
      const response = await adminLoginRequest({ email, password });
      const nextUser = response?.user || response?.data?.user || null;
      const nextRole = nextUser?.role || response?.role || response?.data?.role || null;
      const token = response?.token || response?.data?.token || null;

      if (token) {
        try {
          localStorage.setItem("adminAuthToken", token);
        } catch {
          // ignore storage errors
        }
      }

      if (nextUser) {
        setAdminUser(nextUser);
        setAdminRole(nextRole);
        writeAuthHint("admin", true);
        setIsAdminLoading(false);
      } else {
        await refreshSession({}, "admin");
      }

      queryClient.invalidateQueries({ queryKey: ["admin", "me"], exact: true });
      return { ok: true };
    } catch (error) {
      clearSession("admin");
      return {
        ok: false,
        status: error?.response?.status || null,
        code: error?.response?.data?.code || "",
        message: error?.response?.data?.message || "Login failed.",
        data: error?.response?.data?.data || null,
      };
    }
  };

  const logout = async (scope = currentScope) => {
    try {
      if (scope === "admin") {
        await adminLogoutRequest();
      } else {
        await accountLogoutRequest();
      }
    } catch {
      // ignore logout errors
    } finally {
      clearSession(scope);
      if (scope === "admin") {
        queryClient.removeQueries({ queryKey: ["admin", "me"], exact: true });
      }
    }
  };

  useEffect(() => {
    const hasToken = (() => {
      try {
        return Boolean(
          localStorage.getItem(currentScope === "admin" ? "adminAuthToken" : "authToken")
        );
      } catch {
        return false;
      }
    })();

    const shouldProbe = hasToken || readAuthHint(currentScope);
    if (shouldProbe) {
      refreshSession({ markExpiredOnUnauthorized: true }, currentScope);
    } else if (currentScope === "admin") {
      setIsAdminLoading(false);
    } else {
      setIsAccountLoading(false);
    }

    const unsubscribe = onUnauthorized((payload) => {
      storePendingAuthNotice(resolveUnauthorizedNotice(payload));
      clearSession(currentScope);
      if (currentScope !== "admin") {
        resetBuyerCartSessionSync();
      }
    });

    return unsubscribe;
  }, [currentScope, resetBuyerCartSessionSync]);

  const value = useMemo(
    () => ({
      user: currentUser,
      role: currentRole,
      isAuthenticated: Boolean(currentUser),
      isLoading: currentLoading,
      login,
      logout,
      refreshSession,
      scope: currentScope,
    }),
    [currentUser, currentRole, currentLoading, currentScope]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
