import { createContext, useEffect, useMemo, useRef, useState } from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  me as meRequest,
} from "../api/auth.service.js";
import { api } from "../api/axios.ts";
import { onUnauthorized } from "./authEvents.ts";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "../store/cart.store.ts";
import { bootstrapRemoteCart, syncCartOnLogin } from "../utils/cartSync.ts";

export const AuthContext = createContext(null);

const CART_SYNC_KEY = "cartSync:lastSyncedUserId";
const CART_STORAGE_KEY = "kb_cart_v1";
const LEGACY_CART_STORAGE_KEY = "cart";
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

const readSyncedUserId = () => {
  try {
    const raw = sessionStorage.getItem(CART_SYNC_KEY);
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeSyncedUserId = (userId) => {
  try {
    sessionStorage.setItem(CART_SYNC_KEY, String(userId));
  } catch {
    // ignore storage errors
  }
};

const clearSyncedUserId = () => {
  try {
    sessionStorage.removeItem(CART_SYNC_KEY);
  } catch {
    // ignore storage errors
  }
};

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const hasCartHydrated = useCartStore((state) => state.hasHydrated);
  const cartSyncInFlightRef = useRef(false);
  const lastSyncedUserIdRef = useRef(null);

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

  const refreshSession = async () => {
    setIsLoading(true);
    try {
      const response = await meRequest();
      const nextUser =
        response?.data?.user ??
        response?.user ??
        response?.data ??
        (response && response.id ? response : null);
      if (!nextUser) {
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
    const hasToken = (() => {
      try {
        return Boolean(localStorage.getItem("authToken"));
      } catch {
        return false;
      }
    })();
    const shouldProbe = hasToken || readAuthHint();
    if (shouldProbe) {
      refreshSession();
    } else {
      setIsLoading(false);
    }
    const unsubscribe = onUnauthorized(() => {
      clearSession();
      clearSyncedUserId();
      lastSyncedUserIdRef.current = null;
      cartSyncInFlightRef.current = false;
      const cart = useCartStore.getState();
      cart.reset();
      cart.setMode("guest");
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!hasCartHydrated) return;
    let cancelled = false;
    const roleValue = String(role || "").toLowerCase();
    const isStoreUser = !["admin", "staff", "super_admin"].includes(roleValue);
    const cart = useCartStore.getState();

    const shouldSkipEmptyRemote = (remoteItems) => {
      const localItems = useCartStore.getState().items;
      if (localItems.length > 0 && remoteItems.length === 0) {
        if (import.meta.env.DEV) {
          console.info("[cart-sync] skip overwrite empty remote");
        }
        return true;
      }
      return false;
    };

    const run = async () => {
      if (user && isStoreUser) {
        const userId = Number(user?.id);
        if (!Number.isFinite(userId)) return;
        if (cart.mode === "remote" && lastSyncedUserIdRef.current === userId) {
          return;
        }
        if (cart.mode === "remote" && lastSyncedUserIdRef.current !== userId) {
          cart.setMode("guest");
          lastSyncedUserIdRef.current = null;
          cartSyncInFlightRef.current = false;
          clearSyncedUserId();
        }
        if (cartSyncInFlightRef.current) return;
        if (lastSyncedUserIdRef.current === userId) return;
        const persistedSyncedUserId = readSyncedUserId();
        cartSyncInFlightRef.current = true;
        if (persistedSyncedUserId === userId) {
          try {
            const remoteItems = await bootstrapRemoteCart();
            if (cancelled) return;
            if (shouldSkipEmptyRemote(remoteItems)) {
              return;
            }
            cart.setItems(remoteItems);
            cart.setMode("remote");
            lastSyncedUserIdRef.current = userId;
            writeSyncedUserId(userId);
          } catch (error) {
            if (error?.response?.status === 401) {
              cart.setMode("guest");
              clearSyncedUserId();
              lastSyncedUserIdRef.current = null;
              return;
            }
            return;
          } finally {
            cartSyncInFlightRef.current = false;
          }
          return;
        }
        const guestItems = useCartStore.getState().items;
        try {
          const finalItems = await syncCartOnLogin(guestItems);
          if (cancelled) return;
          if (shouldSkipEmptyRemote(finalItems)) {
            return;
          }
          cart.setItems(finalItems);
          cart.setMode("remote");
          lastSyncedUserIdRef.current = userId;
          writeSyncedUserId(userId);
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
          } catch {
            // ignore storage errors
          }
        } catch (error) {
          // keep guest cart on sync failure
          return;
        } finally {
          cartSyncInFlightRef.current = false;
        }
        return;
      }

      if (cart.mode === "remote") {
        cart.reset();
      }
      cart.setMode("guest");
      lastSyncedUserIdRef.current = null;
      cartSyncInFlightRef.current = false;
      clearSyncedUserId();
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id, role, isLoading, hasCartHydrated]);

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
