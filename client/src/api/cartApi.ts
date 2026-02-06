import { api } from "./axios.ts";

export const getCart = async () => {
  const { data } = await api.get("/cart");
  return data;
};

export const addToCart = async (productId: number, quantity: number) => {
  const { data } = await api.post("/cart/add", { productId, quantity });
  return data;
};

export const removeFromCart = async (productId: number) => {
  const { data } = await api.delete(`/cart/remove/${productId}`);
  return data;
};

export const setCartItemQty = async (productId: number, qty: number) => {
  const { data } = await api.put(`/cart/items/${productId}`, { qty });
  return data;
};

export const debugCartApi = () => {
  if (import.meta.env.DEV) {
    (window as any).cartApi = {
      getCart,
      addToCart,
      removeFromCart,
      setCartItemQty,
    };
  }
};

debugCartApi();
