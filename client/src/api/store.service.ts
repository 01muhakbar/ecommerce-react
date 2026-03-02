import { api } from "./axios";

const isDev = Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export type StoreCategory = {
  id: number;
  name: string;
  slug: string;
  code?: string;
  image?: string | null;
  parentId?: number | null;
  parent_id?: number | null;
  published?: boolean;
};

export type StoreProductCategory = {
  id: number;
  name: string;
  slug: string;
};

export type StoreProduct = {
  id: number;
  name: string;
  price: number;
  imageUrl?: string | null;
  categoryId?: number | null;
  category?: StoreProductCategory | null;
  stock?: number | null;
};

export type StoreProductDetail = StoreProduct & {
  slug?: string;
  description?: string | null;
  salePrice?: number | null;
};

export type StoreCoupon = {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  amount: number;
  minSpend: number;
  expiresAt?: string | null;
};

export type StoreCouponQuoteResponse = {
  valid: boolean;
  reason?: "not_found" | "inactive" | "expired" | "minSpend" | "invalid_input";
  message?: string;
  code: string | null;
  discount: number;
  discountType: "percent" | "fixed" | null;
  discountValue: number;
  minSpend: number;
  expiresAt: string | null;
  subtotal: number;
  shipping: number;
  total: number;
};

export type StoreProductsResponse = {
  data: StoreProduct[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
};

export const fetchStoreCategories = async () => {
  const { data } = await api.get<{ data: StoreCategory[] }>("/store/categories");
  return data;
};

export const fetchStoreProducts = async (params?: {
  search?: string;
  category?: string | number;
  page?: number;
  limit?: number;
}) => {
  const { data } = await api.get<StoreProductsResponse>("/store/products", { params });
  return data;
};

export const fetchStoreProductById = async (id: string | number) => {
  const { data } = await api.get<{ data: StoreProductDetail }>(`/store/products/${id}`);
  return data;
};

export const fetchStoreOrder = async (ref: string) => {
  const { data } = await api.get<{
    data: {
      id: number;
      ref: string;
      invoiceNo?: string | null;
      status: string;
      totalAmount: number;
      paymentMethod?: string | null;
      subtotal?: number;
      discount?: number;
      tax?: number;
      shipping?: number;
      couponCode?: string | null;
      createdAt: string;
      customerName?: string | null;
      customerPhone?: string | null;
      customerAddress?: string | null;
      items: Array<{
        id: number;
        productId: number;
        name: string;
        quantity: number;
        price: number;
        lineTotal: number;
      }>;
    };
  }>(`/store/orders/${encodeURIComponent(ref)}`);
  return data;
};

export const fetchStoreMyOrders = async (params?: { page?: number; limit?: number }) => {
  const { data } = await api.get("/store/my/orders", { params });
  return data;
};

export const createStoreOrder = async (payload: {
  customer: { name: string; phone: string; address: string; notes?: string };
  paymentMethod: "COD";
  items: { productId: number; qty: number }[];
  couponCode?: string;
}) => {
  const url = "/store/orders";
  if (isDev) {
    console.log("[createStoreOrder] url", url);
  }
  const { data } = await api.post<{
    data: {
      id: number;
      ref: string;
      invoiceNo?: string | null;
      status: string;
      totalAmount: number;
      createdAt: string;
      items: Array<{
        productId: number;
        name: string;
        quantity: number;
        price: number;
        lineTotal: number;
      }>;
      subtotal?: number;
      discount?: number;
      tax?: number;
      shipping?: number;
      total: number;
      paymentMethod: "COD";
    };
  }>(url, payload, { withCredentials: true });
  return data;
};

export const fetchStoreCoupons = async () => {
  const { data } = await api.get<{ data: StoreCoupon[] }>("/store/coupons");
  return data;
};

export const validateStoreCoupon = async (payload: { code: string; subtotal: number }) => {
  const response = await api.post<{
    data: {
      valid: boolean;
      code: string | null;
      discountAmount: number;
      message: string;
    };
  }>("/store/coupons/validate", payload);
  return response;
};

export const quoteStoreCoupon = async (payload: {
  code: string;
  subtotal: number;
  shipping?: number;
}) => {
  const { data } = await api.post<StoreCouponQuoteResponse>("/store/coupons/quote", payload);
  return data;
};
