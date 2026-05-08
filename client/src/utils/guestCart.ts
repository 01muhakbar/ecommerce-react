export type GuestCartItem = {
  productId: number;
  qty: number;
  lineId?: string;
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

type GuestVariantSelection = {
  attributeId: number;
  attributeName?: string;
  valueId?: number | null;
  value: string;
};

const STORAGE_KEY = "guest_cart_v1";

const buildGuestCartLineId = (productId: number, variantKey?: string | null) =>
  `${productId}:${String(variantKey || "").trim().toLowerCase() || "base"}`;

const normalizeVariantSelections = (value: unknown): GuestVariantSelection[] => {
  if (!Array.isArray(value)) return [];
  return value.reduce<GuestVariantSelection[]>((acc, entry: any) => {
    const attributeId = Number(entry?.attributeId);
    const valueText = String(entry?.value || "").trim();
    if (!Number.isInteger(attributeId) || attributeId <= 0 || !valueText) {
      return acc;
    }
    acc.push({
      attributeId,
      attributeName: String(entry?.attributeName || "").trim() || undefined,
      valueId: entry?.valueId ?? null,
      value: valueText,
    });
    return acc;
  }, []);
};

const normalizeGuestItem = (item: any): GuestCartItem | null => {
  const productId = Number(item?.productId ?? item?.id);
  const qty = Number(item?.qty ?? item?.quantity ?? 0);
  if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(qty) || qty <= 0) {
    return null;
  }
  const variantKey = String(item?.variantKey || "").trim() || null;
  return {
    productId,
    qty,
    lineId: buildGuestCartLineId(productId, variantKey),
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
    imageUrl: item?.imageUrl ?? item?.image ?? item?.img ?? item?.image_url ?? null,
    variantKey,
    variantLabel: String(item?.variantLabel || "").trim() || null,
    variantSelections: normalizeVariantSelections(item?.variantSelections),
    variantSku: String(item?.variantSku || "").trim() || null,
    variantBarcode: String(item?.variantBarcode || "").trim() || null,
    variantPrice:
      item?.variantPrice !== undefined && item?.variantPrice !== null
        ? Number(item.variantPrice)
        : null,
    variantSalePrice:
      item?.variantSalePrice !== undefined && item?.variantSalePrice !== null
        ? Number(item.variantSalePrice)
        : null,
    variantImage:
      typeof item?.variantImage === "string" || item?.variantImage === null
        ? item?.variantImage ?? null
        : null,
    stock:
      item?.stock !== undefined && item?.stock !== null ? Number(item.stock) : null,
  };
};

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
      .map(normalizeGuestItem)
      .filter((item: GuestCartItem | null): item is GuestCartItem => Boolean(item));
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
    .map(normalizeGuestItem)
    .filter((item: GuestCartItem | null): item is GuestCartItem => Boolean(item));
  writeItems(normalized);
  return normalized;
};

export const addGuestItemSnapshot = (
  productId: number,
  qty = 1,
  snapshot?: Partial<GuestCartItem>
) => {
  const id = Number(productId);
  const safeQty = Math.max(1, Number(qty) || 1);
  if (!Number.isFinite(id) || id <= 0) return readItems();
  const items = readItems();
  const variantKey = String(snapshot?.variantKey || "").trim() || null;
  const lineId = buildGuestCartLineId(id, variantKey);
  const existingLine = items.find((item) => item.lineId === lineId);
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
  if (existingLine) {
    existingLine.qty += safeQty;
    if (nextName) existingLine.name = nextName;
    if (nextPrice !== undefined) existingLine.price = nextPrice;
    if (nextImage !== undefined) existingLine.imageUrl = nextImage;
    existingLine.variantKey = variantKey;
    existingLine.variantLabel = String(snapshot?.variantLabel || "").trim() || null;
    existingLine.variantSelections = normalizeVariantSelections(snapshot?.variantSelections);
    existingLine.variantSku = String(snapshot?.variantSku || "").trim() || null;
    existingLine.variantBarcode = String(snapshot?.variantBarcode || "").trim() || null;
    existingLine.variantPrice =
      snapshot?.variantPrice !== undefined && snapshot?.variantPrice !== null
        ? Number(snapshot.variantPrice)
        : null;
    existingLine.variantSalePrice =
      snapshot?.variantSalePrice !== undefined && snapshot?.variantSalePrice !== null
        ? Number(snapshot.variantSalePrice)
        : null;
    existingLine.variantImage =
      typeof snapshot?.variantImage === "string" || snapshot?.variantImage === null
        ? snapshot?.variantImage ?? null
        : null;
    existingLine.stock =
      snapshot?.stock !== undefined && snapshot?.stock !== null ? Number(snapshot.stock) : null;
  } else {
    items.push({
      productId: id,
      qty: safeQty,
      lineId,
      name: nextName,
      price: nextPrice,
      imageUrl: nextImage,
      variantKey,
      variantLabel: String(snapshot?.variantLabel || "").trim() || null,
      variantSelections: normalizeVariantSelections(snapshot?.variantSelections),
      variantSku: String(snapshot?.variantSku || "").trim() || null,
      variantBarcode: String(snapshot?.variantBarcode || "").trim() || null,
      variantPrice:
        snapshot?.variantPrice !== undefined && snapshot?.variantPrice !== null
          ? Number(snapshot.variantPrice)
          : null,
      variantSalePrice:
        snapshot?.variantSalePrice !== undefined && snapshot?.variantSalePrice !== null
          ? Number(snapshot.variantSalePrice)
          : null,
      variantImage:
        typeof snapshot?.variantImage === "string" || snapshot?.variantImage === null
          ? snapshot?.variantImage ?? null
          : null,
      stock:
        snapshot?.stock !== undefined && snapshot?.stock !== null ? Number(snapshot.stock) : null,
    });
  }
  writeItems(items);
  return items;
};

export const addGuestItem = (productId: number, qty = 1) =>
  addGuestItemSnapshot(productId, qty);

export const updateGuestItem = (
  target: number | { lineId?: string; productId?: number; variantKey?: string | null },
  qty: number
) => {
  const id = Number(typeof target === "number" ? target : target?.productId);
  const variantKey = typeof target === "number" ? null : target?.variantKey;
  const lineId =
    typeof target === "object" && target?.lineId
      ? String(target.lineId)
      : Number.isFinite(id) && id > 0
        ? buildGuestCartLineId(id, variantKey)
        : null;
  const safeQty = Math.max(0, Number(qty) || 0);
  if ((!Number.isFinite(id) || id <= 0) && !lineId) return readItems();
  let items = readItems();
  if (safeQty <= 0) {
    items = items.filter((item) => item.lineId !== lineId);
  } else {
    const existing = items.find((item) => item.lineId === lineId);
    if (existing) {
      existing.qty = safeQty;
    } else {
      items.push({
        productId: id,
        qty: safeQty,
        lineId: lineId || buildGuestCartLineId(id, null),
      });
    }
  }
  writeItems(items);
  return items;
};

export const removeGuestItem = (
  target: number | { lineId?: string; productId?: number; variantKey?: string | null }
) => {
  const id = Number(typeof target === "number" ? target : target?.productId);
  const variantKey = typeof target === "number" ? null : target?.variantKey;
  const lineId =
    typeof target === "object" && target?.lineId
      ? String(target.lineId)
      : Number.isFinite(id) && id > 0
        ? buildGuestCartLineId(id, variantKey)
        : null;
  if ((!Number.isFinite(id) || id <= 0) && !lineId) return readItems();
  const items = readItems().filter((item) => item.lineId !== lineId);
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
