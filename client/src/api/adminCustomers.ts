import api from "./axios"; // asumsikan ini adalah instance axios yang sudah dikonfigurasi

export type CustomerRow = {
  id: string;
  joiningDate: string;
  name: string;
  email: string;
  phone?: string;
};

export type CustomersResp = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  data: CustomerRow[];
};

export const fetchCustomers = (params: {
  page?: number;
  limit?: number;
  q?: string;
  sortBy?: "createdAt" | "name" | "email";
  sort?: "ASC" | "DESC";
  from?: string;
  to?: string;
}) => api.get<CustomersResp>("/admin/customers", { params });

export const exportCustomers = () =>
  api.get("/admin/customers/export", { responseType: "blob" });

export const deleteCustomer = (id: string) =>
  api.delete(`/admin/customers/${id}`);
