import { api } from "@/api/axios";

export type StaffRole = "super_admin" | "admin" | "staff" | "seller" | string;

export interface StaffItem {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string | null;
  avatarUrl?: string | null;
  role: StaffRole;
  status?: string;
  isPendingApproval?: boolean;
  sellerRoleCode?: string | null;
  permissionKeys?: string[];
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

export interface StaffMutationPayload {
  name: string;
  email: string;
  phoneNumber?: string | null;
  role?: string;
  sellerRoleCode?: string | null;
  permissionKeys?: string[];
  isActive?: boolean;
  isPublished?: boolean;
  password?: string;
  image?: File | null;
}

export interface CreateStaffPayload {
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: string;
  sellerRoleCode?: string | null;
  permissionKeys?: string[];
  isActive?: boolean;
  password: string;
  image?: File | null;
}

const hasOwn = (payload: object, key: string) => Object.prototype.hasOwnProperty.call(payload, key);

function buildStaffFormData(payload: Partial<StaffMutationPayload>) {
  const formData = new FormData();
  if (hasOwn(payload, "name")) formData.append("name", String(payload.name ?? ""));
  if (hasOwn(payload, "email")) formData.append("email", String(payload.email ?? ""));
  if (hasOwn(payload, "phoneNumber")) {
    formData.append("phoneNumber", payload.phoneNumber == null ? "" : String(payload.phoneNumber));
  }
  if (hasOwn(payload, "role")) formData.append("role", String(payload.role ?? ""));
  if (hasOwn(payload, "sellerRoleCode")) {
    formData.append("sellerRoleCode", payload.sellerRoleCode == null ? "" : String(payload.sellerRoleCode));
  }
  if (Array.isArray(payload.permissionKeys)) {
    formData.append("permissionKeys", JSON.stringify(payload.permissionKeys));
  }
  if (hasOwn(payload, "isActive") && typeof payload.isActive === "boolean") {
    formData.append("isActive", String(payload.isActive));
  }
  if (hasOwn(payload, "isPublished") && typeof payload.isPublished === "boolean") {
    formData.append("isPublished", String(payload.isPublished));
  }
  if (payload.password) formData.append("password", payload.password);
  if (payload.image instanceof File) formData.append("image", payload.image);
  return formData;
}

export async function fetchStaff(params: StaffQuery = {}): Promise<StaffListResponse> {
  const { data } = await api.get("/admin/staff", { params });
  return data;
}

export async function createStaff(payload: CreateStaffPayload): Promise<StaffItem> {
  const { data } = await api.post("/admin/staff", buildStaffFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as StaffItem;
}

export async function updateStaff(
  id: string | number,
  payload: Partial<StaffMutationPayload>
): Promise<StaffItem> {
  const { data } = await api.patch(`/admin/staff/${id}`, buildStaffFormData(payload), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data as StaffItem;
}

export async function deleteStaff(id: string | number): Promise<{ success: true }> {
  const { data } = await api.delete(`/admin/staff/${id}`);
  return data as { success: true };
}

export async function approveStaffAccount(
  id: string | number
): Promise<{ message: string; data?: { approvalEmailSent?: boolean; user?: StaffItem } }> {
  const { data } = await api.post(`/admin/staff/${id}/approve`);
  return data as { message: string; data?: { approvalEmailSent?: boolean; user?: StaffItem } };
}
