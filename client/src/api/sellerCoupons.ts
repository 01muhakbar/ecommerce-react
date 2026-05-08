import { api } from "./axios.ts";

const textOrNull = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const numberOrZero = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const normalizeSellerCoupon = (payload: any) => {
  if (!payload) return null;

  return {
    id: numberOrZero(payload.id),
    code: textOrFallback(payload.code).toUpperCase(),
    campaignName: textOrNull(payload.campaignName) || textOrFallback(payload.code).toUpperCase(),
    discountType: payload.discountType === "fixed" ? "fixed" : "percent",
    amount: numberOrZero(payload.amount),
    minSpend: numberOrZero(payload.minSpend),
    active: Boolean(payload.active),
    published: Boolean(payload.published ?? payload.active),
    bannerImageUrl: textOrNull(payload.bannerImageUrl),
    scopeType: "STORE",
    storeId: numberOrZero(payload.storeId),
    startsAt: payload.startsAt || null,
    expiresAt: payload.expiresAt || null,
    status: {
      code: textOrFallback(payload?.status?.code, "UNKNOWN"),
      label: textOrFallback(payload?.status?.label, "Unknown"),
      tone: textOrFallback(payload?.status?.tone, "stone"),
      description: textOrNull(payload?.status?.description),
    },
    governance: {
      canView: payload?.governance?.canView !== false,
      canEdit: Boolean(payload?.governance?.canEdit),
      canManageStatus: Boolean(payload?.governance?.canManageStatus),
      sellerOwned: payload?.governance?.sellerOwned !== false,
      adminAuthority: textOrNull(payload?.governance?.adminAuthority),
      storefrontBoundary: textOrNull(payload?.governance?.storefrontBoundary),
    },
    store: payload?.store
      ? {
          id: numberOrZero(payload.store.id),
          name: textOrFallback(payload.store.name, "Store"),
          slug: textOrFallback(payload.store.slug, "store"),
          status: textOrFallback(payload.store.status, "ACTIVE"),
        }
      : null,
    createdAt: payload.createdAt || null,
    updatedAt: payload.updatedAt || null,
  };
};

export const listSellerCoupons = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/coupons`);
  return {
    items: Array.isArray(data?.data?.items)
      ? data.data.items
          .map((entry: any) => normalizeSellerCoupon(entry))
          .filter(Boolean)
      : [],
    store: data?.data?.store
      ? {
          id: numberOrZero(data.data.store.id),
          name: textOrFallback(data.data.store.name, "Store"),
          slug: textOrFallback(data.data.store.slug, "store"),
          status: textOrFallback(data.data.store.status, "ACTIVE"),
        }
      : null,
    governance: {
      lane: textOrFallback(data?.data?.governance?.lane, "SELLER_STORE_COUPONS"),
      scopeType: textOrFallback(data?.data?.governance?.scopeType, "STORE"),
      sellerCanCreate: Boolean(data?.data?.governance?.sellerCanCreate),
      sellerCanEdit: Boolean(data?.data?.governance?.sellerCanEdit),
      sellerCanManageStatus: Boolean(data?.data?.governance?.sellerCanManageStatus),
      adminAuthority: textOrNull(data?.data?.governance?.adminAuthority),
    },
  };
};

export const createSellerCoupon = async (storeId: number | string, payload: Record<string, unknown>) => {
  const { data } = await api.post(`/seller/stores/${storeId}/coupons`, payload);
  return normalizeSellerCoupon(data?.data ?? null);
};

export const updateSellerCoupon = async (
  storeId: number | string,
  couponId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/coupons/${couponId}`, payload);
  return normalizeSellerCoupon(data?.data ?? null);
};

export const deleteSellerCoupon = async (
  storeId: number | string,
  couponId: number | string
) => {
  const { data } = await api.delete(`/seller/stores/${storeId}/coupons/${couponId}`);
  return normalizeSellerCoupon(data?.data ?? null);
};

export const uploadSellerCouponBannerImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = textOrNull(data?.data?.url);
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};
