import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  productId: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  qty: number;
};

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
  const productId = Number(item?.productId ?? item?.id);
  const qty = Number(item?.qty ?? 0);
  if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) {
    return null;
  }
  return {
    productId,
    name: item?.name || "",
    price: Number(item?.price || 0),
    imageUrl: item?.imageUrl ?? null,
    qty,
  };
};

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      totalQty: 0,
      subtotal: 0,
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
      },
      removeItem: (productId) => {
        set((state) => {
          const items = state.items.filter(
            (item) => item.productId !== productId
          );
          const totals = computeTotals(items);
          return { items, ...totals };
        });
      },
      updateQty: (productId, qty) => {
        const safeQty = Math.max(1, qty);
        set((state) => {
          const items = state.items.map((item) =>
            item.productId === productId ? { ...item, qty: safeQty } : item
          );
          const totals = computeTotals(items);
          return { items, ...totals };
        });
      },
      clearCart: () => {
        try {
          localStorage.removeItem("cart");
        } catch {
          // ignore storage errors
        }
        set({ items: [], totalQty: 0, subtotal: 0 });
      },
    }),
    {
      name: "cart",
      partialize: (state) => ({
        items: state.items,
        totalQty: state.totalQty,
        subtotal: state.subtotal,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const normalized = (state.items || [])
          .map(normalizeCartItem)
          .filter((item): item is CartItem => Boolean(item));
        if (import.meta.env.DEV && normalized.length !== (state.items || []).length) {
          console.warn("[cart] Dropped invalid items during rehydrate");
        }
        const totals = computeTotals(normalized);
        state.items = normalized;
        state.totalQty = totals.totalQty;
        state.subtotal = totals.subtotal;
      },
    }
  )
);
