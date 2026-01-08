import { httpGet, httpPut } from "./httpClient.js";
import { orders as dummyOrders } from "../data/orders.js";

export async function getOrders(filters = {}) {
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
    const response = await httpGet(query ? `/orders?${query}` : "/orders");
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
    console.warn("API orders failed, fallback to dummy data");
    const filtered = filterDummyOrders(dummyOrders, cleanFilters);
    const sorted = sortDummy(filtered, sortBy, sortOrder);
    return paginateDummy(sorted, page, limit);
  }
}

export async function updateOrderStatus(id, status) {
  try {
    const response = await httpPut(`/orders/${id}/status`, { status });
    return response?.data ?? response ?? true;
  } catch (error) {
    const index = dummyOrders.findIndex((item) => item.id === id);
    if (index >= 0) {
      dummyOrders[index] = {
        ...dummyOrders[index],
        status,
      };
    }
    return true;
  }
}

function filterDummyOrders(data, filters) {
  return data.filter((item) => {
    if (
      filters.search &&
      !item.customer.toLowerCase().includes(filters.search.toLowerCase())
    ) {
      return false;
    }

    if (filters.status && item.status !== filters.status) {
      return false;
    }

    if (filters.method && item.method !== filters.method) {
      return false;
    }

    if (filters.orderLimit) {
      if (filters.orderLimit === "below-200k" && item.amount >= 200000) {
        return false;
      }
      if (
        filters.orderLimit === "200-500k" &&
        (item.amount < 200000 || item.amount > 500000)
      ) {
        return false;
      }
      if (filters.orderLimit === "above-500k" && item.amount <= 500000) {
        return false;
      }
    }

    if (filters.startDate || filters.endDate) {
      const orderDate = (item.orderTime || item.date || "").split(" ")[0];
      if (filters.startDate && orderDate < filters.startDate) {
        return false;
      }
      if (filters.endDate && orderDate > filters.endDate) {
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
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    if (sortBy === "orderTime") {
      aValue = String(aValue || "").split(" ")[0];
      bValue = String(bValue || "").split(" ")[0];
    }

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
