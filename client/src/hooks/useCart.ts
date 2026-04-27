import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as cartApi from "../api/cartApi.ts";
import { useCartStore } from "../store/cart.store.ts";
import {
  buildLoginRedirectState,
  CART_LOGIN_REQUIRED_NOTICE,
} from "../auth/loginRedirectState.ts";
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
  snapshot?: {
    name?: string;
    price?: number;
    imageUrl?: string | null;
    variantKey?: string | null;
    variantLabel?: string | null;
    variantSelections?: Array<{
      attributeId: number;
      attributeName?: string;
      valueId?: number | null;
      value: string;
    }>;
    variantSku?: string | null;
    variantBarcode?: string | null;
    variantPrice?: number | null;
    variantSalePrice?: number | null;
    variantImage?: string | null;
    stock?: number | null;
  };
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
  lineId: string;
  cartItemId: number | null;
  productId: number;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stock?: number;
  variantKey?: string | null;
  variantLabel?: string | null;
  variantSelections?: Array<{
    attributeId: number;
    attributeName?: string;
    valueId?: number | null;
    value: string;
  }>;
  variantSku?: string | null;
  variantBarcode?: string | null;
};

const buildLineId = (productId: number, variantKey?: string | null) =>
  `${productId}:${String(variantKey || "").trim().toLowerCase() || "base"}`;

const normalizeVariantSelections = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry: any) => {
          const attributeId = Number(entry?.attributeId);
          const valueText = String(entry?.value || "").trim();
          if (!Number.isInteger(attributeId) || attributeId <= 0 || !valueText) return null;
          return {
            attributeId,
            attributeName: String(entry?.attributeName || "").trim() || undefined,
            valueId: entry?.valueId ?? null,
            value: valueText,
          };
        })
        .filter(Boolean)
    : [];

const resolveCartMutationTarget = (target: any) => {
  if (typeof target === "number") {
    const productId = Number(target);
    if (!Number.isFinite(productId) || productId <= 0) return null;
    return {
      productId,
      cartItemId: null,
      lineId: buildLineId(productId, null),
      variantKey: null,
    };
  }
  if (!target || typeof target !== "object") return null;
  const productId = Number(target?.productId ?? target?.id ?? target?.product?.id);
  const cartItemId = Number(target?.cartItemId ?? target?.cartItem?.id);
  const variantKey = String(target?.variantKey || "").trim() || null;
  const explicitLineId = String(target?.lineId || "").trim();
  const lineId =
    explicitLineId || (Number.isFinite(productId) && productId > 0 ? buildLineId(productId, variantKey) : "");
  if ((!Number.isFinite(productId) || productId <= 0) && (!Number.isFinite(cartItemId) || cartItemId <= 0)) {
    return null;
  }
  return {
    productId: Number.isFinite(productId) && productId > 0 ? productId : null,
    cartItemId: Number.isFinite(cartItemId) && cartItemId > 0 ? cartItemId : null,
    lineId: lineId || null,
    variantKey,
  };
};

const isAmbiguousRemoteVariantTarget = (target: {
  cartItemId?: number | null;
  variantKey?: string | null;
}) => Boolean(target?.variantKey) && !Number(target?.cartItemId);

export const normalizeCartProducts = (cart: any): NormalizedCartProduct[] => {
  const items = cart?.Products ?? [];
  return (Array.isArray(items) ? items : [])
    .map((product: any) => {
      const cartItem = product?.CartItem ?? product?.CartItems ?? product?.cartItem ?? null;
      const productId = Number(product?.id ?? product?.productId);
      const quantity = Number(
        cartItem?.quantity ??
          product?.quantity ??
          product?.qty ??
          0
      );
      if (!Number.isFinite(productId) || productId <= 0 || quantity <= 0) {
        return null;
      }
      const cartItemId = Number(cartItem?.id ?? product?.cartItemId);
      const variantKey = String(cartItem?.variantKey || product?.variantKey || "").trim() || null;
      const variantLabel =
        String(cartItem?.variantLabel || product?.variantLabel || "").trim() || null;
      const variantSelections = normalizeVariantSelections(
        cartItem?.variantSelections ?? product?.variantSelections
      );
      const image =
        cartItem?.variantImageSnapshot ??
        product?.imageUrl ??
        product?.image ??
        product?.promoImagePath ??
        (Array.isArray(product?.imagePaths) ? product.imagePaths[0] : null) ??
        null;
      const rawName = String(product?.name || product?.title || "").trim();
      const stockValue = Number(product?.stock ?? product?.availableStock);
      const stock = Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : undefined;
      return {
        lineId: buildLineId(productId, variantKey),
        cartItemId: Number.isFinite(cartItemId) ? cartItemId : null,
        productId,
        name: rawName || `Product #${productId}`,
        price: Number(
          cartItem?.unitSalePriceSnapshot ??
            cartItem?.unitPriceSnapshot ??
            product?.price ??
            product?.salePrice ??
            0
        ),
        image,
        quantity,
        stock,
        variantKey,
        variantLabel,
        variantSelections,
        variantSku:
          String(cartItem?.variantSkuSnapshot || product?.sku || "").trim() || null,
        variantBarcode:
          String(cartItem?.variantBarcodeSnapshot || product?.barcode || "").trim() || null,
      } as NormalizedCartProduct;
    })
    .filter((item): item is NormalizedCartProduct => Boolean(item));
};

export const getCount = (cart: any) =>
  normalizeCartProducts(cart).reduce((sum, item) => sum + item.quantity, 0);

const toStoreItems = (items: NormalizedCartProduct[]) =>
  items.map((item) => ({
    lineId: item.lineId,
    cartItemId: item.cartItemId,
    productId: item.productId,
    name: item.name,
    price: item.price,
    imageUrl: item.image,
    qty: item.quantity,
    stock: item.stock,
    variantKey: item.variantKey ?? null,
    variantLabel: item.variantLabel ?? null,
    variantSelections: item.variantSelections ?? [],
    variantSku: item.variantSku ?? null,
    variantBarcode: item.variantBarcode ?? null,
  }));

const buildFallbackCart = (storeItems: any[]) => ({
  Products: (storeItems || []).map((item) => ({
    id: item.productId,
    name: item.name,
    price: item.price,
    imageUrl: item.imageUrl ?? null,
    CartItem: {
      id: item.cartItemId ?? null,
      quantity: item.qty,
      variantKey: item.variantKey ?? null,
      variantLabel: item.variantLabel ?? null,
      variantSelections: item.variantSelections ?? [],
      variantSkuSnapshot: item.variantSku ?? null,
      variantBarcodeSnapshot: item.variantBarcode ?? null,
    },
  })),
});

const buildGuestCart = (
  items: {
    lineId?: string;
    productId: number;
    qty: number;
    name?: string;
    price?: number;
    imageUrl?: string | null;
    stock?: number | null;
    variantKey?: string | null;
    variantLabel?: string | null;
    variantSelections?: Array<{
      attributeId: number;
      attributeName?: string;
      valueId?: number | null;
      value: string;
    }>;
    variantSku?: string | null;
    variantBarcode?: string | null;
  }[]
) => ({
  Products: (items || []).map((item) => ({
    id: item.productId,
    name: item.name?.trim() || `Product #${item.productId}`,
    price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
    imageUrl: item.imageUrl ?? null,
    stock: item.stock ?? undefined,
    CartItem: {
      id: null,
      quantity: item.qty,
      variantKey: item.variantKey ?? null,
      variantLabel: item.variantLabel ?? null,
      variantSelections: item.variantSelections ?? [],
      variantSkuSnapshot: item.variantSku ?? null,
      variantBarcodeSnapshot: item.variantBarcode ?? null,
    },
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
  const [hasInitialized, setHasInitialized] = useState(false);

  const fallbackCart = useMemo(() => buildFallbackCart(storeItems), [storeItems]);

  const storeSignature = useMemo(
    () =>
      (Array.isArray(storeItems) ? storeItems : [])
        .map((item) => {
          const lineId = String(item?.lineId || buildLineId(Number(item?.productId), item?.variantKey));
          const qty = Math.max(0, Number(item?.qty ?? 0));
          return `${lineId}:${qty}`;
        })
        .filter((value) => !value.startsWith(":"))
        .sort()
        .join("|"),
    [storeItems]
  );

  const rawNormalizedItems = useMemo(() => normalizeCartProducts(rawCart), [rawCart]);
  const rawSignature = useMemo(
    () =>
      rawNormalizedItems
        .map((item) => `${item.lineId}:${item.quantity}`)
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
        lineId: typeof item?.lineId === "string" ? item.lineId : undefined,
        productId: Number(item?.productId),
        qty: Math.max(1, Number(item?.qty ?? 1)),
        name: typeof item?.name === "string" ? item.name : undefined,
        price: Number.isFinite(Number(item?.price)) ? Number(item?.price) : undefined,
        imageUrl:
          typeof item?.imageUrl === "string" || item?.imageUrl === null
            ? item.imageUrl
            : undefined,
        stock: Number.isFinite(Number(item?.stock)) ? Number(item.stock) : undefined,
        variantKey:
          typeof item?.variantKey === "string" || item?.variantKey === null
            ? item.variantKey ?? null
            : undefined,
        variantLabel:
          typeof item?.variantLabel === "string" || item?.variantLabel === null
            ? item.variantLabel ?? null
            : undefined,
        variantSelections: Array.isArray(item?.variantSelections) ? item.variantSelections : undefined,
        variantSku:
          typeof item?.variantSku === "string" || item?.variantSku === null
            ? item.variantSku ?? null
            : undefined,
        variantBarcode:
          typeof item?.variantBarcode === "string" || item?.variantBarcode === null
            ? item.variantBarcode ?? null
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
      snapshot?: {
        name?: string;
        price?: number;
        imageUrl?: string | null;
        variantKey?: string | null;
        variantLabel?: string | null;
        variantSelections?: Array<{
          attributeId: number;
          attributeName?: string;
          valueId?: number | null;
          value: string;
        }>;
        variantSku?: string | null;
        variantBarcode?: string | null;
        variantPrice?: number | null;
        variantSalePrice?: number | null;
        variantImage?: string | null;
        stock?: number | null;
      }
    ) => {
      const id = Number(productId);
      const safeQty = Math.max(1, Number(qty) || 1);
      if (!Number.isFinite(id) || id <= 0) return;
      const fromPath = `${location.pathname}${location.search}${location.hash}`;
      setIsLoading(true);
      setError(null);
      if (mode !== "remote") {
        addGuestItemSnapshot(id, safeQty, snapshot as any);
        refreshGuest();
        setIsLoading(false);
        return;
      }
      try {
        await cartApi.addToCart(id, safeQty, snapshot);
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
          navigate(
            "/auth/login",
            {
              state: buildLoginRedirectState({
                from: fromPath,
                authNotice: CART_LOGIN_REQUIRED_NOTICE,
              }),
            }
          );
          return;
        }
        setError(err);
        await refreshCart(false);
      } finally {
        setIsLoading(false);
      }
    },
    [location, mode, navigate, refreshCart, setMode]
  );

  const update = useCallback(
    async (target: any, qty: number) => {
      const resolved = resolveCartMutationTarget(target);
      const safeQty = Math.max(0, Number(qty) || 0);
      if (!resolved) return;
      setIsLoading(true);
      setError(null);
      if (mode !== "remote") {
        updateGuestItem(
          {
            lineId: resolved.lineId ?? undefined,
            productId: resolved.productId ?? undefined,
            variantKey: resolved.variantKey,
          },
          safeQty
        );
        refreshGuest();
        setIsLoading(false);
        return;
      }
      if (isAmbiguousRemoteVariantTarget(resolved)) {
        await refreshCart(false);
        setIsLoading(false);
        return;
      }
      try {
        await cartApi.setCartItemQty(
          Number(resolved.cartItemId ?? resolved.productId),
          safeQty
        );
        setMode("remote");
        await refreshCart(false);
      } catch (err: any) {
        if (isUnauthorized(err)) {
          updateGuestItem(
            {
              lineId: resolved.lineId ?? undefined,
              productId: resolved.productId ?? undefined,
              variantKey: resolved.variantKey,
            },
            safeQty
          );
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
    async (target: any) => {
      const resolved = resolveCartMutationTarget(target);
      if (!resolved) return;
      setIsLoading(true);
      setError(null);
      if (mode !== "remote") {
        removeGuestItem({
          lineId: resolved.lineId ?? undefined,
          productId: resolved.productId ?? undefined,
          variantKey: resolved.variantKey,
        });
        refreshGuest();
        setIsLoading(false);
        return;
      }
      if (isAmbiguousRemoteVariantTarget(resolved)) {
        await refreshCart(false);
        setIsLoading(false);
        return;
      }
      try {
        await cartApi.removeFromCart(Number(resolved.cartItemId ?? resolved.productId));
        setMode("remote");
        await refreshCart(false);
      } catch (err: any) {
        if (isUnauthorized(err)) {
          removeGuestItem({
            lineId: resolved.lineId ?? undefined,
            productId: resolved.productId ?? undefined,
            variantKey: resolved.variantKey,
          });
          setMode("guest");
          writeRemoteHint(false);
          refreshGuest();
          return;
        }
        setError(err);
        await refreshCart(false);
      } finally {
        setIsLoading(false);
      }
    },
    [mode, refreshCart, refreshGuest, setMode]
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    void (async () => {
      try {
        await refreshCart(true);
      } finally {
        setHasInitialized(true);
      }
    })();
  }, [refreshCart]);

  return {
    cart,
    items,
    hasVariantItems: items.some((item) => Boolean(item.variantKey)),
    count,
    subtotal,
    hasHydrated,
    mode,
    isGuest,
    isLoading,
    error,
    hasInitialized,
    refreshCart,
    add,
    update,
    remove,
  };
}
