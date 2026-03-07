import { api } from "./axios";
import { toUIStatus } from "../constants/orderStatus.js";

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
    status: params.status ?? "",
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
    throw error;
  }
}

export async function getOrder(id) {
  const { data } = await api.get(`/admin/orders/${id}`);
  return data?.data ?? data;
}

export async function updateOrderStatus(id, payload) {
  const nextStatus = typeof payload === "string" ? payload : payload?.status;
  const body =
    typeof payload === "string"
      ? { status: nextStatus }
      : { ...payload, status: nextStatus ?? payload?.status };
  try {
    const response = await api.patch(`/admin/orders/${id}/status`, body);
    return response?.data ?? response ?? true;
  } catch (error) {
    throw error;
  }
}
