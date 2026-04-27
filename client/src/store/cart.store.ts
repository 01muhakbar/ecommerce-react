import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as cartApi from "../api/cartApi.ts";
import { fetchRemoteCartItems } from "../utils/cartSync.ts";

export type CartItem = {
  lineId?: string;
  cartItemId?: number | null;
  productId: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  qty: number;
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
};

const CART_STORAGE_KEY = "kb_cart_v1";
const LEGACY_CART_STORAGE_KEY = "cart";
const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

type CartProduct = {
  id: number;
  productId?: number;
  name: string;
  price: number;
  imageUrl?: string | null;
};

type CartMutationTarget =
  | number
  | {
      lineId?: string | null;
      cartItemId?: number | null;
      productId?: number | null;
      variantKey?: string | null;
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
  removeItem: (target: CartMutationTarget) => void;
  updateQty: (target: CartMutationTarget, qty: number) => void;
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

const buildCartLineId = (productId: number, variantKey?: string | null) =>
  `${productId}:${String(variantKey || "").trim().toLowerCase() || "base"}`;

const resolveLineId = (item: {
  lineId?: string | null;
  productId?: number | null;
  variantKey?: string | null;
}) => {
  const explicitLineId = String(item?.lineId || "").trim();
  if (explicitLineId) return explicitLineId;
  const productId = Number(item?.productId);
  if (!Number.isFinite(productId) || productId <= 0) return null;
  return buildCartLineId(productId, item?.variantKey ?? null);
};

const resolveCartMutationTarget = (target: CartMutationTarget) => {
  if (typeof target === "number") {
    const productId = Number(target);
    if (!Number.isFinite(productId) || productId <= 0) return null;
    return {
      productId,
      cartItemId: null,
      variantKey: null,
      lineId: buildCartLineId(productId, null),
      remoteTargetId: productId,
    };
  }
  if (!target || typeof target !== "object") return null;
  const productId = Number(target?.productId);
  const cartItemId = Number(target?.cartItemId);
  const variantKey = String(target?.variantKey || "").trim() || null;
  const lineId = resolveLineId({
    lineId: target?.lineId,
    productId,
    variantKey,
  });

  return {
    productId: Number.isFinite(productId) && productId > 0 ? productId : null,
    cartItemId: Number.isFinite(cartItemId) && cartItemId > 0 ? cartItemId : null,
    variantKey,
    lineId,
    remoteTargetId:
      Number.isFinite(cartItemId) && cartItemId > 0
        ? cartItemId
        : variantKey
          ? null
          : Number.isFinite(productId) && productId > 0
            ? productId
            : null,
  };
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
    if (isDev) {
      console.warn("[cart] dropping persisted item", item);
    }
    return null;
  }
  const qty = Number(item?.qty ?? item?.quantity ?? item?.count ?? 0);
  if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) {
    if (isDev) {
      console.warn("[cart] dropping persisted item", item);
    }
    return null;
  }
  return {
    lineId:
      resolveLineId({
        lineId: typeof item?.lineId === "string" ? item.lineId : null,
        productId,
        variantKey: String(item?.variantKey || "").trim() || null,
      }) || undefined,
    cartItemId:
      item?.cartItemId !== undefined && item?.cartItemId !== null
        ? Number(item.cartItemId)
        : null,
    productId,
    name: item?.name || item?.title || "",
    price: Number(item?.price || 0),
    imageUrl: item?.imageUrl ?? item?.image ?? item?.img ?? item?.image_url ?? null,
    qty,
    stock:
      item?.stock !== undefined && item?.stock !== null ? Number(item.stock) : null,
    variantKey: String(item?.variantKey || "").trim() || null,
    variantLabel: String(item?.variantLabel || "").trim() || null,
    variantSelections: Array.isArray(item?.variantSelections) ? item.variantSelections : [],
    variantSku: String(item?.variantSku || "").trim() || null,
    variantBarcode: String(item?.variantBarcode || "").trim() || null,
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
      .filter((item: CartItem | null): item is CartItem => Boolean(item));
    if (!normalized.length) return null;
    const totals = computeTotals(normalized);
    return { items: normalized, ...totals };
  } catch {
    return null;
  }
};

const isUnauthorized = (error: any) => error?.response?.status === 401;

const warnDev = (...args: any[]) => {
  if (isDev) {
    console.warn(...args);
  }
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => {
      let pendingQtyByLineId = new Map<
        string,
        {
          remoteTargetId: number;
          desiredQty: number;
        }
      >();
      let remoteBaselineQtyByLineId = new Map<string, number>();
      let flushTimer: number | null = null;
      let refreshTimer: number | null = null;
      let remoteDirty = false;

      const updateRemoteBaseline = (items: CartItem[]) => {
        remoteBaselineQtyByLineId = new Map(
          (items || [])
            .map((item) => {
              const lineId = resolveLineId(item);
              if (!lineId) return null;
              return [lineId, item.qty] as const;
            })
            .filter(
              (
                entry
              ): entry is readonly [string, number] => Boolean(entry)
            )
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
                pendingQtyByLineId.clear();
                remoteBaselineQtyByLineId.clear();
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
          pendingQtyByLineId.clear();
          remoteBaselineQtyByLineId.clear();
          cancelFlushTimer();
          cancelRemoteRefresh();
          return;
        }
        if (get().isRemoteSyncing) {
          scheduleFlushUpdateQty();
          return;
        }
        const started = withRemoteLock(async () => {
          const entries = Array.from(pendingQtyByLineId.entries());
          pendingQtyByLineId.clear();
          if (entries.length === 0) return;

          try {
            let didMutate = false;
            for (const [lineId, entry] of entries) {
              const baselineQty = remoteBaselineQtyByLineId.get(lineId) ?? 0;
              if (entry.remoteTargetId <= 0) {
                continue;
              }
              const desiredQty = entry.desiredQty;
              if (desiredQty === baselineQty) {
                continue;
              }
              await cartApi.setCartItemQty(entry.remoteTargetId, desiredQty);
              didMutate = true;
            }

            if (!didMutate) return;

            for (const [lineId, entry] of entries) {
              const desiredQty = entry.desiredQty;
              if (desiredQty <= 0) {
                remoteBaselineQtyByLineId.delete(lineId);
              } else {
                remoteBaselineQtyByLineId.set(lineId, desiredQty);
              }
            }

            scheduleRemoteRefreshAfterIdle();
          } catch (error) {
            if (isUnauthorized(error)) {
              get().setMode("guest");
              pendingQtyByLineId.clear();
              remoteBaselineQtyByLineId.clear();
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
            if (pendingQtyByLineId.size > 0) {
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
            pendingQtyByLineId.clear();
            remoteBaselineQtyByLineId.clear();
            cancelFlushTimer();
            cancelRemoteRefresh();
          }
        },
        setItems: (items) => {
          const normalized = (Array.isArray(items) ? items : [])
            .map(normalizeCartItem)
            .filter((item: CartItem | null): item is CartItem => Boolean(item));
          const { totalQty, subtotal } = computeTotals(normalized);
          set({ items: normalized, totalQty, subtotal });
        },
        reset: () => {
          try {
            localStorage.removeItem(CART_STORAGE_KEY);
            localStorage.removeItem(LEGACY_CART_STORAGE_KEY);
          } catch {
            // ignore storage errors
          }
          pendingQtyByLineId.clear();
          remoteBaselineQtyByLineId.clear();
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
        removeItem: (target) => {
          const resolvedTarget = resolveCartMutationTarget(target);
          if (!resolvedTarget) return;
          set((state) => {
            const items = state.items.filter(
              (item) =>
                (resolvedTarget.lineId && resolveLineId(item) !== resolvedTarget.lineId) ||
                (!resolvedTarget.lineId && item.productId !== resolvedTarget.productId)
            );
            const totals = computeTotals(items);
            return { items, ...totals };
          });
          if (get().mode !== "remote") return;
          const remoteTargetId = resolvedTarget.remoteTargetId;
          if (!remoteTargetId) {
            warnDev("[cart] removeItem skipped ambiguous remote target", resolvedTarget);
            scheduleRemoteRefreshAfterIdle();
            return;
          }
          withRemoteLock(async () => {
            try {
              await cartApi.removeFromCart(remoteTargetId);
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
        updateQty: (target, qty) => {
          const resolvedTarget = resolveCartMutationTarget(target);
          if (!resolvedTarget) return;
          const desiredQty = Math.max(0, Number(qty) || 0);
          set((state) => {
            const items =
              desiredQty <= 0
                ? state.items.filter(
                    (item) =>
                      (resolvedTarget.lineId &&
                        resolveLineId(item) !== resolvedTarget.lineId) ||
                      (!resolvedTarget.lineId &&
                        item.productId !== resolvedTarget.productId)
                  )
                : state.items.map((item) =>
                    (resolvedTarget.lineId &&
                      resolveLineId(item) === resolvedTarget.lineId) ||
                    (!resolvedTarget.lineId &&
                      item.productId === resolvedTarget.productId)
                      ? { ...item, qty: desiredQty }
                      : item
                  );
            const { totalQty, subtotal } = computeTotals(items);
            return { items, totalQty, subtotal };
          });
          if (get().mode !== "remote") return;
          if (!resolvedTarget.lineId || !resolvedTarget.remoteTargetId) {
            warnDev("[cart] updateQty skipped ambiguous remote target", resolvedTarget);
            scheduleRemoteRefreshAfterIdle();
            return;
          }
          // Coalesce remote updates per exact cart line so variants do not overwrite each other.
          pendingQtyByLineId.set(resolvedTarget.lineId, {
            remoteTargetId: resolvedTarget.remoteTargetId,
            desiredQty,
          });
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
              const remoteTargetIds = [
                ...new Set(
                  snapshot
                    .map((item) => resolveCartMutationTarget(item)?.remoteTargetId ?? null)
                    .filter(
                      (value): value is number =>
                        Number.isFinite(value) && Number(value) > 0
                    )
                ),
              ];
              if (remoteTargetIds.length === 0) {
                const remoteItems = await fetchRemoteCartItems();
                applyRemoteItems(remoteItems);
                return;
              }
              for (const remoteTargetId of remoteTargetIds) {
                await cartApi.removeFromCart(remoteTargetId);
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
          .filter((item: CartItem | null): item is CartItem => Boolean(item));
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
          if (isDev) {
            console.warn("[cart] keeping persisted items after normalization failure");
          }
          state.mode = "guest";
          state.isRemoteSyncing = false;
          state.hasHydrated = true;
          useCartStore.setState({ hasHydrated: true });
          return;
        }
        if (isDev && normalized.length !== rawItems.length) {
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
