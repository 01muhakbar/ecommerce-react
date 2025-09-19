// client/src/api/adminStaff.ts
import api from "./axios";

export type StaffRole =
  | 'Super Admin' | 'Admin' | 'Cashier' | 'CEO' | 'Manager'
  | 'Accountant' | 'Driver' | 'Security Guard' | 'Delivery Person';

export interface StaffItem {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string | null;
  role: StaffRole;
  isActive: boolean;
  isPublished: boolean;
  createdAt: string; // ISO
}

export interface StaffListResponse {
  data: StaffItem[];
  meta: { page: number; limit: number; total: number; totalPages: number; };
}

export const ROLES: StaffRole[] = [
  'Super Admin','Admin','Cashier','CEO','Manager',
  'Accountant','Driver','Security Guard','Delivery Person'
];

export async function fetchStaff(params: {
  page?: number; limit?: number; q?: string; role?: StaffRole | '';
}) {
  const res = await api.get<StaffListResponse>('/v1/admin/staff', { params });
  return res.data;
}

export async function createStaff(payload: {
  name: string; email: string; phoneNumber?: string; role: StaffRole;
  password: string; isActive?: boolean; isPublished?: boolean;
}) {
  const res = await api.post('/v1/admin/staff', payload);
  return res.data;
}

export async function updateStaff(id: number, payload: Partial<Omit<StaffItem,'id'|'createdAt'>>) {
  const res = await api.patch(`/v1/admin/staff/${id}`, payload);
  return res.data;
}

export async function deleteStaff(id: number) {
  const res = await api.delete(`/v1/admin/staff/${id}`);
  return res.data;
}