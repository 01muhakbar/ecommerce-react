import { createContext, useEffect, useMemo, useState } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  me as meRequest,
} from "../api/auth.service.js";
import { api } from "../api/axios.ts";
import { onUnauthorized } from "./authEvents.ts";
import { useQueryClient } from "@tanstack/react-query";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    setUser(null);
    setRole(null);
    setIsLoading(false);
    try {
      localStorage.removeItem("authToken");
    } catch (_) {
      // ignore storage errors
    }
    delete api.defaults.headers.common.Authorization;
  };

  const refreshSession = async () => {
    setIsLoading(true);
    try {
      const response = await meRequest();
      const nextUser = response?.user || response || null;
      const nextRole = response?.user?.role || response?.role || null;
      setUser(nextUser);
      setRole(nextRole);
    } catch (error) {
      clearSession();
      return;
    }
    setIsLoading(false);
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
        setIsLoading(false);
      } else {
        await refreshSession();
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
      return { ok: true };
    } catch (error) {
      clearSession();
      return { ok: false, message: "Login failed." };
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
    refreshSession();
    const unsubscribe = onUnauthorized(() => {
      clearSession();
    });
    return unsubscribe;
  }, []);

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
