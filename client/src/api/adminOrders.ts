import { api } from "@/api/axios";
export const fetchOrders = (p: number, l: number) =>
  api.get(`/admin/orders`, { params: { page: p, limit: l } }).then(r => r.data);
