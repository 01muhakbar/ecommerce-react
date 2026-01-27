import axios from "axios";

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

export const fetchAdminProducts = async (params) => {
  const { data } = await adminApi.get("/admin/products", { params });
  return data;
};

export const fetchAdminCategories = async (params) => {
  const { data } = await adminApi.get("/admin/categories", { params });
  return data;
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
  const { data } = await adminApi.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const fetchAdminOrders = async (params) => {
  const { data } = await adminApi.get("/admin/orders", { params });
  return data;
};

export const fetchAdminOrder = async (id) => {
  const { data } = await adminApi.get(`/admin/orders/${id}`);
  return data;
};

export const updateAdminOrderStatus = async (id, payload) => {
  const { data } = await adminApi.patch(`/admin/orders/${id}/status`, payload);
  return data;
};

export const fetchAdminCustomers = async (params) => {
  const { data } = await adminApi.get("/admin/customers", { params });
  return data;
};

export const fetchAdminCustomer = async (id) => {
  const { data } = await adminApi.get(`/admin/customers/${id}`);
  return data;
};

export const fetchAdminCustomerOrders = async (customerId, params) => {
  const mergedParams = { ...params, userId: customerId };
  const { data } = await adminApi.get("/admin/orders", { params: mergedParams });
  return data;
};
