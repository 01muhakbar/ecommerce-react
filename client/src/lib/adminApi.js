import axios from "axios";
import { toBackendStatus, toUIStatus } from "../constants/orderStatus.js";

const adminApi = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const isAuthEndpoint = url.includes("/auth/login") || url.includes("/auth/logout");
    if (status === 401 && !isAuthEndpoint) {
      window.location.assign("/admin/login");
    }
    return Promise.reject(error);
  }
);

const normalizeProductsMeta = (payload, params = {}) => {
  const meta = payload?.meta || payload?.data?.meta || payload?.pagination || {};
  const page = Number(meta.page ?? meta.currentPage ?? params.page ?? 1);
  const limit = Number(
    meta.limit ?? meta.pageSize ?? params.limit ?? params.pageSize ?? 10
  );
  const total = Number(meta.total ?? meta.totalItems ?? payload?.total ?? 0);
  const rawTotalPages =
    meta.totalPages ?? (limit ? Math.ceil(total / limit) : 1);
  const totalPages = Math.max(1, Number(rawTotalPages || 1));
  return { page, limit, total, totalPages };
};

const normalizeProductsList = (payload, params = {}) => {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.items)
      ? payload.data.items
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
  return {
    data: items,
    meta: normalizeProductsMeta(payload, params),
  };
};

const normalizeCategoriesMeta = (payload, params = {}) => {
  const meta = payload?.meta || payload?.data?.meta || payload?.pagination || {};
  const page = Number(meta.page ?? meta.currentPage ?? params.page ?? 1);
  const limit = Number(meta.limit ?? meta.pageSize ?? params.limit ?? params.pageSize ?? 10);
  const total = Number(meta.total ?? meta.totalItems ?? payload?.total ?? 0);
  const rawTotalPages =
    meta.totalPages ?? (limit ? Math.ceil(total / limit) : 1);
  const totalPages = Math.max(1, Number(rawTotalPages || 1));
  return { page, limit, total, totalPages };
};

const normalizeCategoriesList = (payload, params = {}) => {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.items)
      ? payload.data.items
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
  return {
    data: items,
    meta: normalizeCategoriesMeta(payload, params),
  };
};

const normalizeCustomersMeta = (payload, params = {}) => {
  const meta = payload?.meta || payload?.data?.meta || payload?.pagination || {};
  const page = Number(meta.page ?? meta.currentPage ?? params.page ?? 1);
  const limit = Number(
    meta.limit ?? meta.pageSize ?? params.limit ?? params.pageSize ?? 10
  );
  const total = Number(meta.total ?? meta.totalItems ?? payload?.total ?? 0);
  const rawTotalPages =
    meta.totalPages ?? (limit ? Math.ceil(total / limit) : 1);
  const totalPages = Math.max(1, Number(rawTotalPages || 1));
  return { page, limit, total, totalPages };
};

const normalizeCustomersList = (payload, params = {}) => {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.data?.items)
      ? payload.data.items
      : Array.isArray(payload?.items)
        ? payload.items
        : Array.isArray(payload)
          ? payload
          : [];
  return {
    data: items,
    meta: normalizeCustomersMeta(payload, params),
  };
};

export const fetchAdminProducts = async (params) => {
  const { data } = await adminApi.get("/admin/products", { params });
  return normalizeProductsList(data, params);
};

export const fetchAdminProduct = async (id) => {
  const { data } = await adminApi.get(`/admin/products/${id}`);
  const product = data?.data ?? data?.product ?? data;
  return { data: product };
};

export const fetchAdminCategories = async (params) => {
  const { data } = await adminApi.get("/admin/categories", { params });
  return normalizeCategoriesList(data, params);
};

export const fetchAdminCategory = async (id) => {
  const { data } = await adminApi.get(`/admin/categories/${id}`);
  const category = data?.data ?? data?.category ?? data;
  return { data: category };
};

export const createAdminCategory = async (payload) => {
  const { data } = await adminApi.post("/admin/categories", payload);
  return data;
};

export const updateAdminCategory = async (id, payload) => {
  const { data } = await adminApi.patch(`/admin/categories/${id}`, payload);
  return data;
};

export const deleteAdminCategory = async (id) => {
  const { data } = await adminApi.delete(`/admin/categories/${id}`);
  return data;
};

export const createAdminProduct = async (payload) => {
  const { data } = await adminApi.post("/admin/products", payload);
  return data;
};

export const updateAdminProduct = async (id, payload) => {
  const { data } = await adminApi.patch(`/admin/products/${id}`, payload);
  return data;
};

export const toggleAdminProductPublish = async (id, isPublished) => {
  const { data } = await adminApi.patch(`/admin/products/${id}`, { isPublished });
  return data;
};

export const deleteAdminProduct = async (id) => {
  const { data } = await adminApi.delete(`/admin/products/${id}`);
  return data;
};

export const uploadAdminImage = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await adminApi.post("/admin/uploads", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

const normalizeOrdersMeta = (payload, params = {}) => {
  const meta = payload?.meta || payload?.pagination || {};
  const page = Number(meta.page ?? meta.currentPage ?? params.page ?? 1);
  const limit = Number(
    meta.limit ?? meta.itemsPerPage ?? params.limit ?? params.pageSize ?? 10
  );
  const total = Number(meta.total ?? meta.totalItems ?? payload?.total ?? 0);
  const rawTotalPages =
    meta.totalPages ?? (limit ? Math.ceil(total / limit) : 1);
  const totalPages = Math.max(1, Number(rawTotalPages || 1));
  return { page, limit, total, totalPages };
};

const normalizeOrdersList = (payload, params = {}) => {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : [];
  const data = items.map((order) => ({
    ...order,
    status: toUIStatus(order.status),
    invoice: order.invoiceNo || order.invoice || null,
    invoiceNo: order.invoiceNo || order.invoice || null,
    totalAmount: Number(order.totalAmount || 0),
  }));

  return {
    data,
    meta: normalizeOrdersMeta(payload, params),
  };
};

const normalizeAdminOrderDetail = (raw) => {
  if (!raw) return null;
  return {
    id: raw.id,
    invoice: raw.invoiceNo || raw.invoice || `#${raw.id}`,
    invoiceNo: raw.invoiceNo || raw.invoice || null,
    status: toUIStatus(raw.status),
    totalAmount: Number(raw.totalAmount || 0),
    createdAt: raw.createdAt || null,
    customerName: raw.customerName || raw.customer?.name || "Guest",
    customerPhone: raw.customerPhone || null,
    customerAddress: raw.customerAddress || null,
    customerNotes: raw.customerNotes || null,
    method: raw.method || raw.paymentMethod || "COD",
    items: (raw.items || []).map((it) => ({
      id: it.id,
      productId: it.productId ?? it.product_id ?? it.get?.("productId") ?? null,
      quantity: Number(it.quantity || 0),
      price: Number(it.price || 0),
      lineTotal:
        Number(it.lineTotal || 0) || Number(it.price || 0) * Number(it.quantity || 0),
      product: it.product ? { id: it.product.id, name: it.product.name } : null,
    })),
  };
};

export const fetchAdminOrders = async (params) => {
  const normalizedParams = {
    ...params,
    status: params?.status ? toBackendStatus(params.status) : undefined,
  };
  const { data } = await adminApi.get("/admin/orders", { params: normalizedParams });
  return normalizeOrdersList(data, normalizedParams);
};

export const fetchAdminOrder = async (id) => {
  const { data } = await adminApi.get(`/admin/orders/${id}`);
  const raw = data?.data ?? data?.order ?? data;
  return { data: normalizeAdminOrderDetail(raw) };
};

export const updateAdminOrderStatus = async (id, payload) => {
  const nextStatus = payload?.status;
  const mappedPayload = {
    ...payload,
    status: nextStatus ? toBackendStatus(nextStatus) : nextStatus,
  };
  const { data } = await adminApi.patch(
    `/admin/orders/${id}/status`,
    mappedPayload
  );
  if (data?.data) {
    return {
      ...data,
      data: {
        ...data.data,
        status: toUIStatus(data.data.status),
      },
    };
  }
  return data;
};

export const fetchAdminCustomers = async (params) => {
  const { data } = await adminApi.get("/admin/customers", { params });
  return normalizeCustomersList(data, params);
};

export const fetchAdminCustomer = async (id) => {
  const { data } = await adminApi.get(`/admin/customers/${id}`);
  const customer = data?.data ?? data?.customer ?? data;
  return { data: customer };
};

export const fetchAdminCustomerOrders = async (customerId, params) => {
  const mergedParams = {
    ...params,
    userId: customerId,
    status: params?.status ? toBackendStatus(params.status) : undefined,
  };
  const { data } = await adminApi.get("/admin/orders", { params: mergedParams });
  return normalizeOrdersList(data, mergedParams);
};

export const fetchAdminCoupons = async (params) => {
  const { data } = await adminApi.get("/admin/coupons", { params });
  return data;
};

export const createAdminCoupon = async (payload) => {
  const { data } = await adminApi.post("/admin/coupons", payload);
  return data;
};

export const updateAdminCoupon = async (id, payload) => {
  const { data } = await adminApi.patch(`/admin/coupons/${id}`, payload);
  return data;
};

export const deleteAdminCoupon = async (id) => {
  const { data } = await adminApi.delete(`/admin/coupons/${id}`);
  return data;
};
