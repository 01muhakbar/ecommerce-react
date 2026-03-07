import { api } from "./axios";

export async function listProducts(params = {}) {
  const query = {
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 10,
    q: params.q ?? "",
    sort: params.sort ?? "",
    order: params.order ?? "",
    category: params.category ?? "",
    price: params.price ?? "",
    stockStatus: params.stockStatus ?? "",
  };

  try {
    const response = await api.get("/admin/products", { params: query });
    const payload = response?.data;
    if (payload?.items) {
      return {
        data: payload.items,
        meta: {
          page: payload.page ?? query.page,
          pageSize: payload.pageSize ?? query.pageSize,
          total: payload.total ?? 0,
        },
      };
    }
    if (payload?.data && payload?.meta) {
      return payload;
    }
    if (Array.isArray(payload)) {
      return {
        data: payload,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total: payload.length,
        },
      };
    }
    return { data: [], meta: { page: query.page, pageSize: query.pageSize, total: 0 } };
  } catch (error) {
    throw error;
  }
}

export async function getProduct(id) {
  const { data } = await api.get(`/admin/products/${id}`);
  return data;
}

export async function getProducts(filters = {}) {
  return listProducts({
    page: filters.page ?? 1,
    pageSize: filters.limit ?? 10,
    q: filters.search ?? "",
    sort: filters.sortBy ?? "",
    order: filters.sortOrder ?? "",
    category: filters.category ?? "",
    price: filters.price ?? "",
    stockStatus: filters.stockStatus ?? "",
  });
}

export async function createProduct(payload) {
  try {
    const response = await api.post("/admin/products", payload);
    return response?.data ?? response;
  } catch (error) {
    throw error;
  }
}

export async function deleteProduct(id) {
  try {
    await api.delete(`/admin/products/${id}`);
    return true;
  } catch (error) {
    throw error;
  }
}

export async function updateProduct(id, payload) {
  try {
    const response = await api.put(`/admin/products/${id}`, payload);
    return response?.data ?? response ?? true;
  } catch (error) {
    throw error;
  }
}
