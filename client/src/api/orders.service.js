import { api } from "./axios";
import { orders as dummyOrders } from "../data/orders.js";
import { toBackendStatus, toUIStatus } from "../utils/orderStatus.js";

const mapOrderForUi = (order) => ({
  ...order,
  status: toUIStatus(order.status),
  invoice: order.invoice || order.invoiceNo,
  orderTime: order.orderTime || order.createdAt,
  amount: typeof order.amount === "number" ? order.amount : order.totalAmount,
  customer:
    order.customerName || order.customer?.name || order.customer || "Guest",
});

export async function listOrders(params = {}) {
  const query = {
    page: params.page ?? 1,
    limit: params.pageSize ?? 10,
    q: params.q ?? "",
    status: params.status ? toBackendStatus(params.status) : "",
    sort: params.sort ?? "",
    order: params.order ?? "",
    method: params.method ?? "",
    orderLimit: params.orderLimit ?? "",
    startDate: params.startDate ?? "",
    endDate: params.endDate ?? "",
  };

  try {
    const response = await api.get("/admin/orders", { params: query });
    const payload = response?.data;
    if (payload && payload.data && payload.meta) {
      const mapped = payload.data.map(mapOrderForUi);
      return { ...payload, data: mapped };
    }
    if (Array.isArray(payload)) {
      return {
        data: payload.map(mapOrderForUi),
        meta: {
          page: query.page,
          limit: query.limit,
          total: payload.length,
        },
      };
    }
    return {
      data: [],
      meta: { page: query.page, limit: query.limit, total: 0 },
    };
  } catch (error) {
    const allowDummyFallback =
      import.meta.env.DEV && import.meta.env.VITE_ALLOW_DUMMY_ORDERS === "true";
    if (!allowDummyFallback) {
      throw error;
    }
    const filtered = filterDummyOrders(dummyOrders, {
      search: query.q,
      status: query.status,
      method: query.method,
      orderLimit: query.orderLimit,
      startDate: query.startDate,
      endDate: query.endDate,
    });
    const sorted = sortDummy(filtered, query.sort, query.order || "asc");
    const paged = paginateDummy(sorted, query.page, query.limit);
    return { ...paged, data: paged.data.map(mapOrderForUi) };
  }
}

export async function getOrder(id) {
  const { data } = await api.get(`/admin/orders/${id}`);
  return data?.data ?? data;
}

export async function updateOrderStatus(id, payload) {
  const nextStatus = typeof payload === "string" ? payload : payload?.status;
  const apiStatus = toBackendStatus(nextStatus);
  const body =
    typeof payload === "string"
      ? { status: apiStatus }
      : { ...payload, status: apiStatus ?? payload?.status };
  try {
    const response = await api.patch(`/admin/orders/${id}/status`, body);
    return response?.data ?? response ?? true;
  } catch (error) {
    const allowDummyFallback =
      import.meta.env.DEV && import.meta.env.VITE_ALLOW_DUMMY_ORDERS === "true";
    if (!allowDummyFallback) {
      throw error;
    }
    const index = dummyOrders.findIndex((item) => item.id === id);
    if (index >= 0) {
      dummyOrders[index] = {
        ...dummyOrders[index],
        status: toUIStatus(nextStatus),
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

    const uiStatus = toUIStatus(item.status);
    if (filters.status && uiStatus !== filters.status) {
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
