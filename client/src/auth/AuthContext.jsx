import { createContext, useEffect, useMemo, useState } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  me as meRequest,
} from "../api/auth.service.js";
import { onUnauthorized } from "./authEvents.ts";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearSession = () => {
    setUser(null);
    setRole(null);
    setIsLoading(false);
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
    try {
      await loginRequest({ email, password });
      await refreshSession();
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
      // ignore logout errors and clear local session
    }
    clearSession();
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
