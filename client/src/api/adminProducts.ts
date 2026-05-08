import { api } from "@/api/axios";
export const fetchProducts = (page=1, limit=10) =>
  api.get(`/admin/products`, { params: { page, limit } }).then(r => r.data);
