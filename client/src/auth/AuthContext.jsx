import { createContext, useEffect, useMemo, useState } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  me as meRequest,
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

const AUTH_SESSION_KEY = "authSessionHint";

const readAuthHint = () => {
  try {
    return localStorage.getItem(AUTH_SESSION_KEY) === "true";
  } catch {
    return false;
  }
};

const writeAuthHint = (value) => {
  try {
    if (value) {
      localStorage.setItem(AUTH_SESSION_KEY, "true");
    } else {
      localStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch {
    // ignore storage errors
  }
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { resetBuyerCartSessionSync } = useBuyerCartSessionSync({ user, role, isLoading });

  const clearSession = () => {
    setUser(null);
    setRole(null);
    setIsLoading(false);
    try {
      localStorage.removeItem("authToken");
      writeAuthHint(false);
    } catch (_) {
      // ignore storage errors
    }
    delete api.defaults.headers.common.Authorization;
  };

  const refreshSession = async (options = {}) => {
    const markExpiredOnUnauthorized = options?.markExpiredOnUnauthorized === true;
    setIsLoading(true);
    try {
      const response = await meRequest();
      const nextUser =
        response?.data?.user ??
        response?.user ??
        response?.data ??
        (response && response.id ? response : null);
      if (!nextUser) {
        if (markExpiredOnUnauthorized) {
          storePendingAuthNotice(DEFAULT_SESSION_EXPIRED_NOTICE);
        }
        clearSession();
        return;
      }
      const nextRole = String(nextUser?.role ?? "").toLowerCase() || null;
      setUser(nextUser);
      setRole(nextRole);
      writeAuthHint(true);
      if (import.meta.env.DEV) {
        console.log("[auth] refreshSession user", nextUser);
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        if (markExpiredOnUnauthorized) {
          storePendingAuthNotice(resolveUnauthorizedNotice({
            status,
            code: error?.response?.data?.code,
            message: error?.response?.data?.message,
          }));
        }
        clearSession();
        return;
      }
      if (import.meta.env.DEV) {
        console.info("[auth] refreshSession skipped", error);
      }
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email, password) => {
    if (!email || !password) {
      return { ok: false, message: "Email and password are required." };
    }
    setIsLoading(true);
    try {
      const response = await loginRequest({ email, password });
      const nextUser = response?.user || response?.data?.user || null;
      const nextRole = nextUser?.role || response?.role || response?.data?.role || null;
      const token = response?.token || response?.data?.token || null;
      if (token) {
        try {
          localStorage.setItem("authToken", token);
        } catch (_) {
          // ignore storage errors
        }
        api.defaults.headers.common.Authorization = `Bearer ${token}`;
      }
      if (nextUser) {
        setUser(nextUser);
        setRole(nextRole);
        writeAuthHint(true);
        setIsLoading(false);
      } else {
        await refreshSession();
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      return { ok: true };
    } catch (error) {
      clearSession();
      return {
        ok: false,
        status: error?.response?.status || null,
        code: error?.response?.data?.code || "",
        message: error?.response?.data?.message || "Login failed.",
        data: error?.response?.data?.data || null,
      };
    }
  };

  const logout = async () => {
    try {
      await logoutRequest();
    } catch (error) {
      // ignore logout errors
    } finally {
      clearSession();
      queryClient.removeQueries({ queryKey: ["admin", "me"], exact: true });
    }
  };

  useEffect(() => {
    const hasToken = (() => {
      try {
        return Boolean(localStorage.getItem("authToken"));
      } catch {
        return false;
      }
    })();
    const shouldProbe = hasToken || readAuthHint();
    if (shouldProbe) {
      refreshSession({ markExpiredOnUnauthorized: true });
    } else {
      setIsLoading(false);
    }
    const unsubscribe = onUnauthorized((payload) => {
      storePendingAuthNotice(resolveUnauthorizedNotice(payload));
      clearSession();
      resetBuyerCartSessionSync();
    });
    return unsubscribe;
  }, [resetBuyerCartSessionSync]);

  const value = useMemo(
    () => ({
      user,
      role,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      refreshSession,
    }),
    [user, role, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
