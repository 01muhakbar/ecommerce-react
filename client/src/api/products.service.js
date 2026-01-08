import { httpDelete, httpGet, httpPost, httpPut } from "./httpClient.js";
import { products as dummyProducts } from "../data/products.js";

export async function getProducts(filters = {}) {
  const page = Number(filters.page) || 1;
  const limit = Number(filters.limit) || 10;
  const sortBy = filters.sortBy || "";
  const sortOrder = filters.sortOrder || "asc";
  const cleanFilters = { ...filters };
  delete cleanFilters.page;
  delete cleanFilters.limit;
  delete cleanFilters.sortBy;
  delete cleanFilters.sortOrder;
  delete cleanFilters.refreshKey;

  try {
    const query = new URLSearchParams(
      Object.entries({
        ...cleanFilters,
        page,
        limit,
        sort: sortBy,
        order: sortOrder,
      }).filter(
        ([, value]) => value !== ""
      )
    ).toString();
    const response = await httpGet(query ? `/products?${query}` : "/products");
    const payload = response.data ?? response;
    if (payload && payload.data && payload.meta) {
      return payload;
    }
    if (Array.isArray(payload)) {
      const sorted = sortDummy(payload, sortBy, sortOrder);
      return paginateDummy(sorted, page, limit);
    }
    return { data: [], meta: { page, limit, total: 0 } };
  } catch (error) {
    console.warn("API products failed, fallback to dummy data");
    const filtered = filterDummyProducts(dummyProducts, cleanFilters);
    const sorted = sortDummy(filtered, sortBy, sortOrder);
    return paginateDummy(sorted, page, limit);
  }
}

export async function createProduct(payload) {
  try {
    const response = await httpPost("/products", payload);
    return response?.data ?? response;
  } catch (error) {
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
  try {
    await httpDelete(`/products/${id}`);
    return true;
  } catch (error) {
    const index = dummyProducts.findIndex((item) => item.id === id);
    if (index >= 0) {
      dummyProducts.splice(index, 1);
    }
    return true;
  }
}

export async function updateProduct(id, payload) {
  try {
    const response = await httpPut(`/products/${id}`, payload);
    return response?.data ?? response ?? true;
  } catch (error) {
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
