import { api } from "@/api/axios";

export type StaffRole =
  | "Super Admin"
  | "Admin"
  | "Cashier"
  | "CEO"
  | "Manager"
  | "Accountant"
  | "Driver"
  | "Security Guard"
  | "Delivery Person";

export interface StaffItem {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: StaffRole;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface StaffListResponse {
  rows: StaffItem[];
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface StaffQuery {
  page?: number;
  limit?: number;
  q?: string;
  role?: StaffRole | "";
  sortBy?: "createdAt" | "name" | "email" | "role";
  sort?: "ASC" | "DESC";
}

export async function fetchStaff(params: StaffQuery = {}): Promise<StaffListResponse> {
  const { data } = await api.get("/admin/staff", { params });
  return data;
}

export async function createStaff(payload: Omit<StaffItem, "id" | "createdAt" | "updatedAt">) {
  const { data } = await api.post("/admin/staff", payload);
  return data as StaffItem;
}

export async function updateStaff(id: number, payload: Partial<StaffItem>) {
  const { data } = await api.patch(`/admin/staff/${id}`, payload);
  return data as StaffItem;
}

export async function deleteStaff(id: number) {
  const { data } = await api.delete(`/admin/staff/${id}`);
  return data as { success: true };
}