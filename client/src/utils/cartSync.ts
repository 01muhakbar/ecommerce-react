import type { CartItem } from "../store/cart.store.ts";
import * as cartApi from "../api/cartApi.ts";

const normalizeImageUrl = (value?: string | null) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return value;
  return `/uploads/${value}`;
};

export const normalizeRemoteCartToItems = (remotePayload: any): CartItem[] => {
  const cart = remotePayload?.data ?? remotePayload ?? {};
  const products = Array.isArray(cart?.Products)
    ? cart.Products
    : Array.isArray(cart?.products)
    ? cart.products
    : [];

  return products
    .map((product: any) => {
      const productId = Number(product?.id ?? product?.productId);
      const qty = Number(
        product?.CartItem?.quantity ??
          product?.cartItem?.quantity ??
          product?.quantity ??
          product?.qty ??
          0
      );
      if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) {
        return null;
      }
      const rawImage =
        product?.imageUrl ||
        product?.image ||
        product?.thumbnail ||
        product?.promoImagePath ||
        (Array.isArray(product?.imagePaths) ? product.imagePaths[0] : null);
      return {
        productId,
        name: product?.name || product?.productName || "",
        price: Number(product?.price ?? product?.salePrice ?? 0),
        imageUrl: normalizeImageUrl(rawImage),
        qty,
      } as CartItem;
    })
    .filter((item): item is CartItem => Boolean(item));
};

export const fetchRemoteCartItems = async (): Promise<CartItem[]> => {
  const payload = await cartApi.getCart();
  return normalizeRemoteCartToItems(payload);
};

export const bootstrapRemoteCart = async (): Promise<CartItem[]> =>
  fetchRemoteCartItems();

export const mergeGuestItemsToRemote = async (
  guestItems: CartItem[]
): Promise<void> => {
  for (const item of guestItems || []) {
    const productId = Number(item?.productId);
    const qty = Number(item?.qty ?? 0);
    if (!Number.isFinite(productId) || productId <= 0 || qty <= 0) {
      continue;
    }
    await cartApi.addToCart(productId, qty);
  }
};

export const syncCartOnLogin = async (
  guestItems: CartItem[]
): Promise<CartItem[]> => {
  await fetchRemoteCartItems();
  if (Array.isArray(guestItems) && guestItems.length > 0) {
    await mergeGuestItemsToRemote(guestItems);
  }
  return fetchRemoteCartItems();
};

if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as any).cartSync = {
    syncCartOnLogin,
    fetchRemoteCartItems,
    bootstrapRemoteCart,
  };
}
