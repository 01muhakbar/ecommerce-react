import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as cartApi from "../api/cartApi.ts";
import { useCartStore } from "../store/cart.store.ts";
import {
  addGuestItemSnapshot,
  getGuestCart,
  hasGuestCartStorage,
  removeGuestItem,
  setGuestCartItems,
  updateGuestItem,
} from "../utils/guestCart.ts";

const isUnauthorized = (error: any) => error?.response?.status === 401;
const REMOTE_HINT_KEY = "cart_remote_ok";
const PENDING_ADD_KEY = "pending_cart_add";
const AUTH_SESSION_KEY = "authSessionHint";

const readRemoteHint = () => {
  try {
    return sessionStorage.getItem(REMOTE_HINT_KEY) === "true";
  } catch {
    return false;
  }
};

const writeRemoteHint = (value: boolean) => {
  try {
    sessionStorage.setItem(REMOTE_HINT_KEY, value ? "true" : "false");
  } catch {
    // ignore storage errors
  }
};

const hasAuthSessionSignal = () => {
  try {
    const token = localStorage.getItem("authToken");
    if (token) return true;
    return localStorage.getItem(AUTH_SESSION_KEY) === "true";
  } catch {
    return false;
  }
};

const stashPendingAdd = (payload: {
  productId: number;
  qty: number;
  nonce?: string;
  snapshot?: { name?: string; price?: number; imageUrl?: string | null };
  from?: string;
}) => {
  try {
    const nonce =
      payload.nonce ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(PENDING_ADD_KEY, JSON.stringify({ ...payload, nonce }));
  } catch {
    // ignore storage errors
  }
};

type NormalizedCartProduct = {
  productId: number;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock?: number;
};

export const normalizeCartProducts = (cart: any): NormalizedCartProduct[] => {
  const items = cart?.Products ?? [];
  return (Array.isArray(items) ? items : [])
    .map((product: any) => {
      const productId = Number(product?.id ?? product?.productId);
      const quantity = Number(
        product?.CartItem?.quantity ??
          product?.CartItems?.quantity ??
          product?.quantity ??
          product?.qty ??
          0
      );
      if (!Number.isFinite(productId) || productId <= 0 || quantity <= 0) {
        return null;
      }
      const image =
        product?.imageUrl ??
        product?.image ??
        product?.promoImagePath ??
        (Array.isArray(product?.imagePaths) ? product.imagePaths[0] : null) ??
        null;
      const rawName = String(product?.name || product?.title || "").trim();
      const stockValue = Number(product?.stock ?? product?.availableStock);
      const stock = Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : undefined;
      return {
        productId,
        name: rawName || `Product #${productId}`,
        price: Number(product?.price ?? product?.salePrice ?? 0),
        image,
        quantity,
        stock,
      } as NormalizedCartProduct;
    })
    .filter((item): item is NormalizedCartProduct => Boolean(item));
};

export const getCount = (cart: any) =>
  normalizeCartProducts(cart).reduce((sum, item) => sum + item.quantity, 0);

const toStoreItems = (items: NormalizedCartProduct[]) =>
  items.map((item) => ({
    productId: item.productId,
    name: item.name,
    price: item.price,
    imageUrl: item.image,
    qty: item.quantity,
  }));

const buildFallbackCart = (storeItems: any[]) => ({
  Products: (storeItems || []).map((item) => ({
    id: item.productId,
    name: item.name,
    price: item.price,
    imageUrl: item.imageUrl ?? null,
    CartItem: { quantity: item.qty },
  })),
});

const buildGuestCart = (
  items: { productId: number; qty: number; name?: string; price?: number; imageUrl?: string | null }[]
) => ({
  Products: (items || []).map((item) => ({
    id: item.productId,
    name: item.name?.trim() || `Product #${item.productId}`,
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
    imageUrl: item.imageUrl ?? null,
    CartItem: { quantity: item.qty },
  })),
});

// Manual test (browser):
// guest: /search?q=apple → add → /cart → plus/minus → remove → cek badge
// login: /auth/login → add → /cart → plus/minus → remove → cek badge
export function useCart() {
  const navigate = useNavigate();
  const location = useLocation();
  const storeItems = useCartStore((state) => state.items);
  const subtotal = useCartStore((state) => state.subtotal);
  const hasHydrated = useCartStore((state) => state.hasHydrated);
  const mode = useCartStore((state) => state.mode);
  const setMode = useCartStore((state) => state.setMode);
  const setItems = useCartStore((state) => state.setItems);
  const initRef = useRef(false);

  const [rawCart, setRawCart] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const fallbackCart = useMemo(() => buildFallbackCart(storeItems), [storeItems]);

  const storeSignature = useMemo(
    () =>
      (Array.isArray(storeItems) ? storeItems : [])
        .map((item) => {
          const productId = Number(item?.productId ?? item?.id);
          const qty = Math.max(0, Number(item?.qty ?? item?.quantity ?? 0));
          return `${productId}:${qty}`;
        })
        .filter((value) => !value.startsWith("NaN:"))
        .sort()
        .join("|"),
    [storeItems]
  );

  const rawNormalizedItems = useMemo(() => normalizeCartProducts(rawCart), [rawCart]);
  const rawSignature = useMemo(
    () =>
      rawNormalizedItems
        .map((item) => `${item.productId}:${item.quantity}`)
        .sort()
        .join("|"),
    [rawNormalizedItems]
  );

  const cart = useMemo(() => {
    if (!rawCart) {
      return fallbackCart;
    }
    if (mode !== "remote") {
      return fallbackCart;
    }
    // Multiple useCart() instances can hold stale rawCart; prefer shared store snapshot
    // when quantities/products are out of sync so drawer always reflects latest add/remove.
    if (rawSignature !== storeSignature) {
      return fallbackCart;
    }
    return rawCart;
  }, [fallbackCart, mode, rawCart, rawSignature, storeSignature]);
  const items = useMemo(() => normalizeCartProducts(cart), [cart]);
  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const isGuest = mode !== "remote";

  const applyGuestItems = useCallback(
    (
      guestItems: {
        productId: number;
        qty: number;
        name?: string;
        price?: number;
        imageUrl?: string | null;
      }[]
    ) => {
      const guestCart = buildGuestCart(guestItems);
      setRawCart(guestCart);
      const normalized = normalizeCartProducts(guestCart);
      setItems(toStoreItems(normalized));
      setMode("guest");
    },
    [setItems, setMode]
  );

  const refreshGuest = useCallback(() => {
    const guest = getGuestCart();
    const guestItems = Array.isArray(guest?.items) ? guest.items : [];
    if (guestItems.length > 0 || hasGuestCartStorage()) {
      applyGuestItems(guestItems);
      return;
    }
    const fallbackItems = (Array.isArray(storeItems) ? storeItems : [])
      .map((item) => ({
        productId: Number(item?.productId ?? item?.id),
        qty: Math.max(1, Number(item?.qty ?? item?.quantity ?? 1)),
        name: typeof item?.name === "string" ? item.name : undefined,
        price: Number.isFinite(Number(item?.price)) ? Number(item?.price) : undefined,
        imageUrl:
          typeof item?.imageUrl === "string" || item?.imageUrl === null
            ? item.imageUrl
            : undefined,
      }))
      .filter(
        (item) =>
          Number.isFinite(item.productId) &&
          item.productId > 0 &&
          Number.isFinite(item.qty) &&
          item.qty > 0
      );
    if (fallbackItems.length > 0) {
      // One-time migration from persisted cart store to guest_cart_v1.
      setGuestCartItems(fallbackItems);
    }
    applyGuestItems(fallbackItems);
  }, [applyGuestItems, storeItems]);

  const refreshCart = useCallback(
    async (withLoading = true) => {
      const shouldForceRemote = withLoading === false;
      const hasAuthSignal = hasAuthSessionSignal();
      const shouldAttemptRemote =
        hasAuthSignal && (mode === "remote" || shouldForceRemote || readRemoteHint());
      if (!shouldAttemptRemote) {
        if (mode !== "guest") {
          setMode("guest");
        }
        writeRemoteHint(false);
        refreshGuest();
        return;
      }
      if (withLoading) {
        setIsLoading(true);
        setError(null);
      }
      try {
        const payload = await cartApi.getCart();
        setRawCart(payload);
        const normalized = normalizeCartProducts(payload);
        setItems(toStoreItems(normalized));
        setMode("remote");
        writeRemoteHint(true);
      } catch (err: any) {
        if (isUnauthorized(err)) {
          setError(null);
          setMode("guest");
          writeRemoteHint(false);
          refreshGuest();
          return;
        }
        setError(err);
      } finally {
        if (withLoading) {
          setIsLoading(false);
        }
      }
    },
    [mode, refreshGuest, setItems, setMode]
  );

  const add = useCallback(
    async (
      productId: number,
      qty = 1,
      snapshot?: { name?: string; price?: number; imageUrl?: string | null }
    ) => {
      const id = Number(productId);
      const safeQty = Math.max(1, Number(qty) || 1);
      if (!Number.isFinite(id) || id <= 0) return;
      const fromPath = `${location.pathname}${location.search}${location.hash}`;
      setIsLoading(true);
      setError(null);
      if (mode !== "remote") {
        addGuestItemSnapshot(id, safeQty, snapshot);
        refreshGuest();
        setIsLoading(false);
        return;
      }
      try {
        await cartApi.addToCart(id, safeQty);
        setMode("remote");
        await refreshCart(false);
      } catch (err: any) {
        if (isUnauthorized(err)) {
          writeRemoteHint(false);
          stashPendingAdd({
            productId: id,
            qty: safeQty,
            snapshot,
            from: fromPath,
          });
          navigate("/auth/login", { state: { from: fromPath } });
          return;
        }
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [location, mode, navigate, refreshCart, setMode]
  );

  const update = useCallback(
    async (productId: number, qty: number) => {
      const id = Number(productId);
      const safeQty = Math.max(0, Number(qty) || 0);
      if (!Number.isFinite(id) || id <= 0) return;
      setIsLoading(true);
      setError(null);
      if (mode !== "remote") {
        updateGuestItem(id, safeQty);
        refreshGuest();
        setIsLoading(false);
        return;
      }
      try {
        await cartApi.setCartItemQty(id, safeQty);
        setMode("remote");
        await refreshCart(false);
      } catch (err: any) {
        if (isUnauthorized(err)) {
          updateGuestItem(id, safeQty);
          setMode("guest");
          writeRemoteHint(false);
          refreshGuest();
          return;
        }
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, refreshCart, refreshGuest, setMode]
  );

  const remove = useCallback(
    async (productId: number) => {
      const id = Number(productId);
      if (!Number.isFinite(id) || id <= 0) return;
      setIsLoading(true);
      setError(null);
      if (mode !== "remote") {
        removeGuestItem(id);
        refreshGuest();
        setIsLoading(false);
        return;
      }
      try {
        await cartApi.removeFromCart(id);
        setMode("remote");
        await refreshCart(false);
      } catch (err: any) {
        if (isUnauthorized(err)) {
          removeGuestItem(id);
          setMode("guest");
          writeRemoteHint(false);
          refreshGuest();
          return;
        }
        setError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, refreshCart, refreshGuest, setMode]
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void refreshCart(true);
  }, [refreshCart]);

  return {
    cart,
    items,
    count,
    subtotal,
    hasHydrated,
    mode,
    isGuest,
    isLoading,
    error,
    refreshCart,
    add,
    update,
    remove,
  };
}
