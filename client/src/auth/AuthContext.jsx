import { createContext, useEffect, useMemo, useState } from "react";
import { login as loginRequest } from "../api/auth.service.js";
import { setAuthToken, setUnauthorizedHandler } from "../api/httpClient.js";

const STORAGE_KEY = "auth_session";

export const AuthContext = createContext(null);

function getStoredSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const stored = getStoredSession();
  const [user, setUser] = useState(stored?.user || null);
  const [role, setRole] = useState(stored?.role || null);
  const [token, setToken] = useState(stored?.token || "");

  const login = async (email, password) => {
    if (!email || !password) {
      return { ok: false, message: "Email and password are required." };
    }

    try {
      const response = await loginRequest({ email, password });
      const nextUser = response?.user || { email };
      const nextToken = response?.token || "";
      const nextRole = response?.user?.role || response?.role || null;

      if (!nextToken) {
        return { ok: false, message: "Invalid credentials." };
      }

      setUser(nextUser);
      setRole(nextRole);
      setToken(nextToken);
      setAuthToken(nextToken);
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: nextUser, role: nextRole, token: nextToken })
      );
      return { ok: true };
    } catch (error) {
      return { ok: false, message: "Login failed." };
    }
  };

  const logout = () => {
    setUser(null);
    setRole(null);
    setToken("");
    setAuthToken("");
    localStorage.removeItem(STORAGE_KEY);
  };

  useEffect(() => {
    setAuthToken(token);
  }, [token]);

  useEffect(() => {
    setUnauthorizedHandler(logout);
  }, []);

  const value = useMemo(
    () => ({
      user,
      role,
      isAuthenticated: Boolean(user),
      login,
      logout,
    }),
    [user, role]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
