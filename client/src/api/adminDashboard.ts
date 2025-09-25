import { api } from "@/api/axios";
export const fetchDashboardStats = () =>
  api.get("/admin/dashboard/statistics").then(r => r.data);
