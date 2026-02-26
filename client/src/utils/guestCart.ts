export type GuestCartItem = {
  productId: number;
  qty: number;
  name?: string;
  price?: number;
  imageUrl?: string | null;
};

const STORAGE_KEY = "guest_cart_v1";

const hasStorageValue = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
};

const readItems = (): GuestCartItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    return items
      .map((item: any) => ({
        productId: Number(item?.productId ?? item?.id),
        qty: Number(item?.qty ?? item?.quantity ?? 0),
        name:
          typeof item?.name === "string"
            ? item.name
            : typeof item?.title === "string"
            ? item.title
            : undefined,
        price:
          item?.price !== undefined || item?.salePrice !== undefined
            ? Number(item?.price ?? item?.salePrice ?? 0)
            : undefined,
        imageUrl:
          item?.imageUrl ?? item?.image ?? item?.img ?? item?.image_url ?? null,
      }))
      .filter(
        (item: GuestCartItem) =>
          Number.isFinite(item.productId) &&
          item.productId > 0 &&
          Number.isFinite(item.qty) &&
          item.qty > 0
      );
  } catch {
    return [];
  }
};

const writeItems = (items: GuestCartItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    // ignore storage errors
  }
};

export const getGuestCart = () => ({ items: readItems() });

export const hasGuestCartStorage = () => hasStorageValue();

export const setGuestCartItems = (items: GuestCartItem[]) => {
  const normalized = (Array.isArray(items) ? items : [])
    .map((item: any) => ({
      productId: Number(item?.productId ?? item?.id),
      qty: Number(item?.qty ?? item?.quantity ?? 0),
      name: typeof item?.name === "string" ? item.name : undefined,
      price: Number.isFinite(Number(item?.price)) ? Number(item.price) : undefined,
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
  writeItems(normalized);
  return normalized;
};

export const addGuestItemSnapshot = (
  productId: number,
  qty = 1,
  snapshot?: { name?: string; price?: number; imageUrl?: string | null }
) => {
  const id = Number(productId);
  const safeQty = Math.max(1, Number(qty) || 1);
  if (!Number.isFinite(id) || id <= 0) return readItems();
  const items = readItems();
  const existing = items.find((item) => item.productId === id);
  const nextName =
    typeof snapshot?.name === "string" && snapshot.name.trim()
      ? snapshot.name.trim()
      : undefined;
  const nextPrice =
    Number.isFinite(Number(snapshot?.price)) && Number(snapshot?.price) > 0
      ? Number(snapshot?.price)
      : undefined;
  const nextImage =
    typeof snapshot?.imageUrl === "string" || snapshot?.imageUrl === null
      ? snapshot?.imageUrl ?? null
      : undefined;
  if (existing) {
    existing.qty += safeQty;
    if (nextName) existing.name = nextName;
    if (nextPrice !== undefined) existing.price = nextPrice;
    if (nextImage !== undefined) existing.imageUrl = nextImage;
  } else {
    items.push({
      productId: id,
      qty: safeQty,
      name: nextName,
      price: nextPrice,
      imageUrl: nextImage,
    });
  }
  writeItems(items);
  return items;
};

export const addGuestItem = (productId: number, qty = 1) =>
  addGuestItemSnapshot(productId, qty);

export const updateGuestItem = (productId: number, qty: number) => {
  const id = Number(productId);
  const safeQty = Math.max(0, Number(qty) || 0);
  if (!Number.isFinite(id) || id <= 0) return readItems();
  let items = readItems();
  if (safeQty <= 0) {
    items = items.filter((item) => item.productId !== id);
  } else {
    const existing = items.find((item) => item.productId === id);
    if (existing) {
      existing.qty = safeQty;
    } else {
      items.push({ productId: id, qty: safeQty });
    }
  }
  writeItems(items);
  return items;
};

export const removeGuestItem = (productId: number) => {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) return readItems();
  const items = readItems().filter((item) => item.productId !== id);
  writeItems(items);
  return items;
};

export const clearGuestCart = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
};
