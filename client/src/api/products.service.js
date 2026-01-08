import { api } from "./axios";
import { products as dummyProducts } from "../data/products.js";

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
    const allowDummyFallback =
      import.meta.env.DEV && import.meta.env.VITE_ALLOW_DUMMY_PRODUCTS === "true";
    if (!allowDummyFallback) {
      throw error;
    }
    const filtered = filterDummyProducts(dummyProducts, {
      search: query.q,
      category: query.category,
      price: query.price,
      stockStatus: query.stockStatus,
    });
    const sorted = sortDummy(filtered, query.sort, query.order || "asc");
    return paginateDummy(sorted, query.page, query.pageSize);
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
  const allowDummyFallback =
    import.meta.env.DEV && import.meta.env.VITE_ALLOW_DUMMY_PRODUCTS === "true";
  try {
    const response = await api.post("/admin/products", payload);
    return response?.data ?? response;
  } catch (error) {
    if (!allowDummyFallback) {
      throw error;
    }
    const price = Number(payload.price) || 0;
    const nextProduct = {
      id: `prd-${Date.now()}`,
      name: payload.name,
      image: "/img/tshirt.png",
      category: payload.category || "Uncategorized",
      price,
      salePrice: price,
      stock: 0,
      status: "soldout",
      published: false,
    };
    dummyProducts.unshift(nextProduct);
    return nextProduct;
  }
}

export async function deleteProduct(id) {
  const allowDummyFallback =
    import.meta.env.DEV && import.meta.env.VITE_ALLOW_DUMMY_PRODUCTS === "true";
  try {
    await api.delete(`/admin/products/${id}`);
    return true;
  } catch (error) {
    if (!allowDummyFallback) {
      throw error;
    }
    const index = dummyProducts.findIndex((item) => item.id === id);
    if (index >= 0) {
      dummyProducts.splice(index, 1);
    }
    return true;
  }
}

export async function updateProduct(id, payload) {
  const allowDummyFallback =
    import.meta.env.DEV && import.meta.env.VITE_ALLOW_DUMMY_PRODUCTS === "true";
  try {
    const response = await api.put(`/admin/products/${id}`, payload);
    return response?.data ?? response ?? true;
  } catch (error) {
    if (!allowDummyFallback) {
      throw error;
    }
    const index = dummyProducts.findIndex((item) => item.id === id);
    if (index >= 0) {
      dummyProducts[index] = {
        ...dummyProducts[index],
        ...payload,
      };
    }
    return true;
  }
}

function filterDummyProducts(data, filters) {
  return data.filter((item) => {
    if (
      filters.search &&
      !item.name.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    if (filters.category && item.category !== filters.category) {
      return false;
    }

    if (filters.stockStatus) {
      if (filters.stockStatus === "low") {
        if (item.stock >= 10000) {
          return false;
        }
      } else if (item.status !== filters.stockStatus) {
        return false;
      }
    }

    if (filters.price) {
      if (filters.price === "below-200k" && item.price >= 200000) {
        return false;
      }
      if (
        filters.price === "200-500k" &&
        (item.price < 200000 || item.price > 500000)
      ) {
        return false;
      }
      if (filters.price === "above-500k" && item.price <= 500000) {
        return false;
      }
    }

    return true;
  });
}

function paginateDummy(data, page, limit) {
  const start = (page - 1) * limit;
  return {
    data: data.slice(start, start + limit),
    meta: {
      page,
      limit,
      total: data.length,
    },
  };
}

function sortDummy(data, sortBy, sortOrder) {
  if (!sortBy) {
    return data;
  }

  return [...data].sort((a, b) => {
    const aValue = a[sortBy];
    const bValue = b[sortBy];

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortOrder === "asc" ? aValue - bValue : bValue - aValue;
    }

    const aText = String(aValue || "").toLowerCase();
    const bText = String(bValue || "").toLowerCase();
    if (aText < bText) {
      return sortOrder === "asc" ? -1 : 1;
    }
    if (aText > bText) {
      return sortOrder === "asc" ? 1 : -1;
    }
    return 0;
  });
}
