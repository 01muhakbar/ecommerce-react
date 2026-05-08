import { api } from "./axios.ts";

export type SellerCategory = {
  id: number;
  code?: string | null;
  name: string;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  parentId?: number | null;
  parent?: {
    id: number;
    name: string;
    code?: string | null;
  } | null;
  isPublished: boolean;
  published?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type SellerCategoryListParams = {
  q?: string;
  published?: "" | "true" | "false";
  page?: number;
  limit?: number;
};

type SellerCategoryWritePayload = {
  name: string;
  description?: string;
  parentId?: number | null;
  image?: string | null;
  isPublished?: boolean;
};

const normalizeCategory = (item: any): SellerCategory | null => {
  if (!item || typeof item !== "object") return null;
  const id = Number(item.id || 0);
  if (!Number.isInteger(id) || id <= 0) return null;
  return {
    id,
    code: String(item.code || "").trim() || null,
    name: String(item.name || "").trim() || `Category #${id}`,
    description: String(item.description || "").trim() || null,
    image: String(item.image || item.icon || "").trim() || null,
    icon: String(item.icon || item.image || "").trim() || null,
    parentId: Number(item.parentId ?? item.parent_id ?? 0) || null,
    parent:
      item.parent && typeof item.parent === "object"
        ? {
            id: Number(item.parent.id || 0) || 0,
            name: String(item.parent.name || "").trim() || "-",
            code: String(item.parent.code || "").trim() || null,
          }
        : null,
    isPublished: Boolean(item.isPublished ?? item.published),
    published: Boolean(item.isPublished ?? item.published),
    createdAt: String(item.createdAt || "").trim() || null,
    updatedAt: String(item.updatedAt || "").trim() || null,
  };
};

const normalizeCategoryListResponse = (payload: any) => {
  const dataRoot = payload?.data && typeof payload.data === "object" ? payload.data : payload;
  const items = Array.isArray(dataRoot?.items)
    ? dataRoot.items
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload)
          ? payload
          : [];

  const metaRoot = dataRoot?.meta || payload?.meta || {};
  return {
    data: items.map(normalizeCategory).filter(Boolean) as SellerCategory[],
    meta: {
      page: Number(metaRoot.page || 1) || 1,
      limit: Number(metaRoot.limit || 10) || 10,
      total: Number(metaRoot.total || items.length) || 0,
      totalPages: Number(metaRoot.totalPages || 1) || 1,
    },
  };
};

const normalizeCategoryDetailResponse = (payload: any) => {
  const item = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;
  return {
    data: normalizeCategory(item),
  };
};

export const getSellerCategories = async (
  storeId: number | string,
  params: SellerCategoryListParams = {},
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/categories`, { params });
  return normalizeCategoryListResponse(data);
};

export const createSellerCategory = async (
  storeId: number | string,
  payload: SellerCategoryWritePayload,
) => {
  const { data } = await api.post(`/seller/stores/${storeId}/categories`, payload);
  return normalizeCategoryDetailResponse(data);
};

export const updateSellerCategory = async (
  storeId: number | string,
  categoryId: number | string,
  payload: Partial<SellerCategoryWritePayload>,
) => {
  const { data } = await api.put(`/seller/stores/${storeId}/categories/${categoryId}`, payload);
  return normalizeCategoryDetailResponse(data);
};

export const setSellerCategoryPublished = async (
  storeId: number | string,
  categoryId: number | string,
  isPublished: boolean,
) => {
  const { data } = await api.patch(
    `/seller/stores/${storeId}/categories/${categoryId}/publish`,
    { isPublished },
  );
  return normalizeCategoryDetailResponse(data);
};

export const uploadSellerCategoryImage = async (file: File) => {
  const form = new FormData();
  form.append("image", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};
