import { api } from "./axios";

export async function getOverview() {
  const { data } = await api.get("/admin/analytics/overview");
  return data;
}

export async function getSummary(days = 7) {
  const { data } = await api.get("/admin/analytics/summary", {
    params: { days },
  });
  return data;
}

export async function getSales(range = "7d") {
  const { data } = await api.get("/admin/analytics/sales", {
    params: { range },
  });
  return data;
}

export async function getWeeklySales(days = 7) {
  const { data } = await api.get("/admin/analytics/weekly-sales", {
    params: { days },
  });
  return data;
}

export async function getBestSelling(days = 7, limit = 5) {
  const { data } = await api.get("/admin/analytics/best-selling", {
    params: { days, limit },
  });
  return data;
}

export async function getRecentOrders(limit = 10) {
  const { data } = await api.get("/admin/analytics/recent-orders", {
    params: { limit },
  });
  return data;
}

export async function updateOrderStatus(id, payload) {
  const { data } = await api.put(`/admin/orders/${id}/status`, payload);
  return data;
}
