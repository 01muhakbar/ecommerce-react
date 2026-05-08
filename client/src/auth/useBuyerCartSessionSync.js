import { useCallback, useEffect, useRef } from "react";
import { useCartStore } from "../store/cart.store.ts";
import { bootstrapRemoteCart, syncCartOnLogin } from "../utils/cartSync.ts";

const CART_SYNC_KEY = "cartSync:lastSyncedUserId";
const CART_STORAGE_KEY = "kb_cart_v1";
const LEGACY_CART_STORAGE_KEY = "cart";

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

export function useBuyerCartSessionSync({ user, role, isLoading }) {
  const hasCartHydrated = useCartStore((state) => state.hasHydrated);
  const cartSyncInFlightRef = useRef(false);
  const lastSyncedUserIdRef = useRef(null);

  const resetBuyerCartSessionSync = useCallback(() => {
    clearSyncedUserId();
    lastSyncedUserIdRef.current = null;
    cartSyncInFlightRef.current = false;
    const cart = useCartStore.getState();
    cart.reset();
    cart.setMode("guest");
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

  return { resetBuyerCartSessionSync };
}
