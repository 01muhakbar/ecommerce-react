import { api } from "./axios.ts";

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export const getCart = async () => {
  const { data } = await api.get("/cart");
  return data;
};

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

const buildCartVariantPayload = (snapshot?: Record<string, unknown>) => {
  if (!snapshot || typeof snapshot !== "object") return {};
  const variantKey = String(snapshot.variantKey || "").trim();
  const variantSelections = normalizeVariantSelections(snapshot.variantSelections);
  if (!variantKey && variantSelections.length === 0) return {};
  return {
    variantKey: variantKey || undefined,
    variantSelections,
  };
};

export const addToCart = async (
  productId: number,
  quantity: number,
  snapshot?: Record<string, unknown>
) => {
  const { data } = await api.post("/cart/add", {
    productId,
    quantity,
    ...buildCartVariantPayload(snapshot),
  });
  return data;
};

export const removeFromCart = async (itemId: number) => {
  const { data } = await api.delete(`/cart/items/by-id/${itemId}`);
  return data;
};

export const setCartItemQty = async (itemId: number, qty: number) => {
  const { data } = await api.put(`/cart/items/by-id/${itemId}`, { qty });
  return data;
};

export const debugCartApi = () => {
  if (isDev) {
    (window as any).cartApi = {
      getCart,
      addToCart,
      removeFromCart,
      setCartItemQty,
    };
  }
};

debugCartApi();
