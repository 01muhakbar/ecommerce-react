import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as cartApi from "../api/cartApi.ts";
import { fetchRemoteCartItems } from "../utils/cartSync.ts";

export type CartItem = {
  productId: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  qty: number;
};

const CART_STORAGE_KEY = "kb_cart_v1";
const LEGACY_CART_STORAGE_KEY = "cart";

type CartProduct = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
};

type CartState = {
  items: CartItem[];
  totalQty: number;
  subtotal: number;
  mode: "guest" | "remote";
  isRemoteSyncing: boolean;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  setMode: (mode: "guest" | "remote") => void;
  setItems: (items: CartItem[]) => void;
  reset: () => void;
  addItem: (product: CartProduct, qty?: number) => void;
  removeItem: (productId: number) => void;
  updateQty: (productId: number, qty: number) => void;
  clearCart: () => void;
};

const computeTotals = (items: CartItem[]) => {
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = items.reduce(
    (sum, item) => sum + Number(item.price || 0) * item.qty,
    0
  );
  return { totalQty, subtotal };
};

const normalizeCartItem = (item: any): CartItem | null => {
  const rawId =
    item?.productId ?? item?.id ?? item?._id ?? item?.product_id ?? item?.productID;
  let productId: number | null = null;
  if (typeof rawId === "number") {
    productId = rawId;
  } else if (typeof rawId === "string") {
    const trimmed = rawId.trim();
    if (trimmed && /^[0-9]+$/.test(trimmed)) {
      productId = Number(trimmed);
    }
  }
  if (!productId) {
    const rawSku = item?.sku ?? item?.SKU;
    if (typeof rawSku === "number") {
      productId = rawSku;
    } else if (typeof rawSku === "string") {
      const trimmedSku = rawSku.trim();
      if (trimmedSku && /^[0-9]+$/.test(trimmedSku)) {
        productId = Number(trimmedSku);
      }
    }
  }
  if (productId === null) {
    if (import.meta.env.DEV) {
      console.warn("[cart] dropping persisted item", item);
    }
    return null;
  }
  const qty = Number(item?.qty ?? item?.quantity ?? item?.count ?? 0);
  if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) {
    if (import.meta.env.DEV) {
      console.warn("[cart] dropping persisted item", item);
    }
    return null;
  }
  return {
    productId,
    name: item?.name || item?.title || "",
    price: Number(item?.price || 0),
    imageUrl: item?.imageUrl ?? item?.image ?? item?.img ?? item?.image_url ?? null,
    qty,
  };
};

const readPersistedCart = (storageKey: string) => {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const state = parsed?.state ?? parsed;
    const items = Array.isArray(state?.items) ? state.items : [];
    const normalized = items
      .map(normalizeCartItem)
      .filter((item): item is CartItem => Boolean(item));
    if (!normalized.length) return null;
    const totals = computeTotals(normalized);
    return { items: normalized, ...totals };
  } catch {
    return null;
  }
};

const isUnauthorized = (error: any) => error?.response?.status === 401;

const warnDev = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.warn(...args);
  }
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      let pendingQtyByProductId = new Map<number, number>();
      let remoteBaselineQtyByProductId = new Map<number, number>();
      let flushTimer: number | null = null;
      let refreshTimer: number | null = null;
      let remoteDirty = false;

      const updateRemoteBaseline = (items: CartItem[]) => {
        remoteBaselineQtyByProductId = new Map(
          (items || []).map((item) => [item.productId, item.qty])
        );
      };

      const applyRemoteItems = (items: CartItem[]) => {
        get().setItems(items);
        updateRemoteBaseline(get().items);
      };

      const cancelFlushTimer = () => {
        if (flushTimer !== null) {
          clearTimeout(flushTimer);
          flushTimer = null;
        }
      };

      const cancelRemoteRefresh = () => {
        if (refreshTimer !== null) {
          clearTimeout(refreshTimer);
          refreshTimer = null;
        }
        remoteDirty = false;
      };

      const scheduleRemoteRefreshAfterIdle = () => {
        remoteDirty = true;
        if (refreshTimer !== null) {
          clearTimeout(refreshTimer);
        }
        refreshTimer = window.setTimeout(() => {
          refreshTimer = null;
          if (!remoteDirty) {
            return;
          }
          if (get().mode !== "remote") {
            cancelRemoteRefresh();
            return;
          }
          if (get().isRemoteSyncing) {
            scheduleRemoteRefreshAfterIdle();
            return;
          }
          const started = withRemoteLock(async () => {
            try {
              const remoteItems = await fetchRemoteCartItems();
              applyRemoteItems(remoteItems);
              remoteDirty = false;
            } catch (error) {
              if (isUnauthorized(error)) {
                get().setMode("guest");
                pendingQtyByProductId.clear();
                remoteBaselineQtyByProductId.clear();
                cancelFlushTimer();
                cancelRemoteRefresh();
                return;
              }
              warnDev("[cart] refresh failed", error);
            }
          });
          if (!started) {
            scheduleRemoteRefreshAfterIdle();
          }
        }, 900);
      };

      const withRemoteLock = (fn: () => Promise<void>) => {
        if (get().isRemoteSyncing) return false;
        set({ isRemoteSyncing: true });
        void (async () => {
          try {
            await fn();
          } finally {
            set({ isRemoteSyncing: false });
          }
        })();
        return true;
      };

      const scheduleFlushUpdateQty = () => {
        if (flushTimer !== null) {
          clearTimeout(flushTimer);
        }
        flushTimer = window.setTimeout(() => {
          flushTimer = null;
          flushPendingUpdateQty();
        }, 300);
      };

      const flushPendingUpdateQty = () => {
        if (get().mode !== "remote") {
          pendingQtyByProductId.clear();
          remoteBaselineQtyByProductId.clear();
          cancelFlushTimer();
          cancelRemoteRefresh();
          return;
        }
        if (get().isRemoteSyncing) {
          scheduleFlushUpdateQty();
          return;
        }
        const started = withRemoteLock(async () => {
          const entries = Array.from(pendingQtyByProductId.entries());
          pendingQtyByProductId.clear();
          if (entries.length === 0) return;

          try {
            let didMutate = false;
            for (const [productId, desiredQty] of entries) {
              const baselineQty =
                remoteBaselineQtyByProductId.get(productId) ?? 0;
              if (desiredQty === baselineQty) {
                continue;
              }
              await cartApi.setCartItemQty(productId, desiredQty);
              didMutate = true;
            }

            if (!didMutate) return;

            for (const [productId, desiredQty] of entries) {
              if (desiredQty <= 0) {
                remoteBaselineQtyByProductId.delete(productId);
              } else {
                remoteBaselineQtyByProductId.set(productId, desiredQty);
              }
            }

            scheduleRemoteRefreshAfterIdle();
          } catch (error) {
            if (isUnauthorized(error)) {
              get().setMode("guest");
              pendingQtyByProductId.clear();
              remoteBaselineQtyByProductId.clear();
              cancelFlushTimer();
              cancelRemoteRefresh();
              return;
            }
            warnDev("[cart] updateQty flush failed", error);
            try {
              const remoteItems = await fetchRemoteCartItems();
              applyRemoteItems(remoteItems);
            } catch (innerError) {
              warnDev("[cart] updateQty refresh failed", innerError);
            }
          } finally {
            if (pendingQtyByProductId.size > 0) {
              scheduleFlushUpdateQty();
            }
          }
        });
        if (!started) {
          scheduleFlushUpdateQty();
        }
      };

      return {
        items: [],
        totalQty: 0,
        subtotal: 0,
        mode: "guest",
        isRemoteSyncing: false,
        hasHydrated: false,
        setHasHydrated: (value) => set({ hasHydrated: value }),
        setMode: (mode) => {
          set({ mode });
          if (mode === "remote") {
            updateRemoteBaseline(get().items);
          } else {
            pendingQtyByProductId.clear();
            remoteBaselineQtyByProductId.clear();
            cancelFlushTimer();
            cancelRemoteRefresh();
          }
        },
        setItems: (items) => {
          const normalized = (items || [])
            .map(normalizeCartItem)
            .filter((item): item is CartItem => Boolean(item));
          const totals = computeTotals(normalized);
          set({ items: normalized, ...totals });
        },
        reset: () => {
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
          } catch {
            // ignore storage errors
          }
          pendingQtyByProductId.clear();
          remoteBaselineQtyByProductId.clear();
          cancelFlushTimer();
          cancelRemoteRefresh();
          set({ items: [], totalQty: 0, subtotal: 0 });
        },
        addItem: (product, qty = 1) => {
          const safeQty = Math.max(1, qty);
          const productId = Number(product?.productId ?? product?.id);
          if (!Number.isFinite(productId) || productId <= 0) {
            return;
          }
          set((state) => {
            const existing = state.items.find(
              (item) => item.productId === productId
            );
            let items: CartItem[];
            if (existing) {
              items = state.items.map((item) =>
                item.productId === productId
                  ? { ...item, qty: item.qty + safeQty }
                  : item
              );
            } else {
              items = [
                ...state.items,
                {
                  productId,
                  name: product?.name || "",
                  price: Number(product?.price || 0),
                  imageUrl: product?.imageUrl ?? null,
                  qty: safeQty,
                },
              ];
            }
            const totals = computeTotals(items);
            return { items, ...totals };
          });
          if (get().mode !== "remote") return;
          withRemoteLock(async () => {
            try {
              await cartApi.addToCart(productId, safeQty);
              const remoteItems = await fetchRemoteCartItems();
              applyRemoteItems(remoteItems);
            } catch (error) {
              if (isUnauthorized(error)) {
                get().setMode("guest");
                return;
              }
              warnDev("[cart] addItem sync failed", error);
              try {
                const remoteItems = await fetchRemoteCartItems();
                applyRemoteItems(remoteItems);
              } catch (innerError) {
                warnDev("[cart] addItem refresh failed", innerError);
              }
            }
          });
        },
        removeItem: (productId) => {
          set((state) => {
            const items = state.items.filter(
              (item) => item.productId !== productId
            );
            const totals = computeTotals(items);
            return { items, ...totals };
          });
          if (get().mode !== "remote") return;
          withRemoteLock(async () => {
            try {
              await cartApi.removeFromCart(productId);
              const remoteItems = await fetchRemoteCartItems();
              applyRemoteItems(remoteItems);
            } catch (error) {
              if (isUnauthorized(error)) {
                get().setMode("guest");
                return;
              }
              warnDev("[cart] removeItem sync failed", error);
              try {
                const remoteItems = await fetchRemoteCartItems();
                applyRemoteItems(remoteItems);
              } catch (innerError) {
                warnDev("[cart] removeItem refresh failed", innerError);
              }
            }
          });
        },
        updateQty: (productId, qty) => {
          const isRemote = get().mode === "remote";
          // Clamp remote qty to avoid negative/NaN causing invalid API calls
          const desiredQty = isRemote
            ? Math.max(0, Number(qty) || 0)
            : Math.max(1, Number(qty) || 1);
          set((state) => {
            const items =
              isRemote && desiredQty <= 0
                ? state.items.filter((item) => item.productId !== productId)
                : state.items.map((item) =>
                    item.productId === productId
                      ? { ...item, qty: desiredQty }
                      : item
                  );
            const totals = computeTotals(items);
            return { items, ...totals };
          });
          if (get().mode !== "remote") return;
          // coalescing updateQty to latest per productId
          pendingQtyByProductId.set(productId, desiredQty);
          scheduleFlushUpdateQty();
        },
        clearCart: () => {
          const snapshot = get().items;
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
          } catch {
            // ignore storage errors
          }
          set({ items: [], totalQty: 0, subtotal: 0 });
          if (get().mode !== "remote") return;
          withRemoteLock(async () => {
            try {
              for (const item of snapshot) {
                await cartApi.removeFromCart(item.productId);
              }
              const remoteItems = await fetchRemoteCartItems();
              applyRemoteItems(remoteItems);
            } catch (error) {
              if (isUnauthorized(error)) {
                get().setMode("guest");
                get().setItems(snapshot);
                return;
              }
              warnDev("[cart] clearCart sync failed", error);
              try {
                const remoteItems = await fetchRemoteCartItems();
                applyRemoteItems(remoteItems);
              } catch (innerError) {
                warnDev("[cart] clearCart refresh failed", innerError);
              }
            }
          });
        },
      };
    },
    {
      name: CART_STORAGE_KEY,
      partialize: (state) => ({
        items: state.items,
        totalQty: state.totalQty,
        subtotal: state.subtotal,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) {
          useCartStore.setState({ hasHydrated: true });
          return;
        }
        const rawItems = Array.isArray(state.items) ? state.items : [];
        let normalized = rawItems
          .map(normalizeCartItem)
          .filter((item): item is CartItem => Boolean(item));
        if (!normalized.length) {
          const legacy = readPersistedCart(LEGACY_CART_STORAGE_KEY);
          if (legacy) {
            normalized = legacy.items;
            state.totalQty = legacy.totalQty;
            state.subtotal = legacy.subtotal;
            try {
              localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
            } catch {
              // ignore storage errors
            }
          }
        }
        if (rawItems.length > 0 && normalized.length === 0) {
          if (import.meta.env.DEV) {
            console.warn("[cart] keeping persisted items after normalization failure");
          }
          state.mode = "guest";
          state.isRemoteSyncing = false;
          state.hasHydrated = true;
          useCartStore.setState({ hasHydrated: true });
          return;
        }
        if (
          import.meta.env.DEV &&
          normalized.length !== rawItems.length
        ) {
          console.warn("[cart] Dropped invalid items during rehydrate");
        }
        const totals = computeTotals(normalized);
        state.items = normalized;
        state.totalQty = totals.totalQty;
        state.subtotal = totals.subtotal;
        state.mode = "guest";
        state.isRemoteSyncing = false;
        state.hasHydrated = true;
        useCartStore.setState({ hasHydrated: true });
      },
    }
  )
);
