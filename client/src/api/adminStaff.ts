import api from './axios';

export type StaffRole =
 | 'Super Admin'| 'Admin'| 'Cashier'| 'CEO'| 'Manager'| 'Accountant'| 'Driver'| 'Security Guard'| 'Delivery Person' | 'user' | 'seller';

export interface StaffItem {
  id: number; name: string; email: string; phoneNumber?: string;
  role: StaffRole; isActive: boolean; isPublished: boolean; createdAt: string;
}

export interface StaffListResponse {
  data: StaffItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }
}

export const fetchStaff = (params: { page?: number; limit?: number; q?: string; role?: string; sortBy?: string; sort?: 'ASC'|'DESC' }) =>
  api.get<StaffListResponse>('/admin/staff', { params });

export const createStaff = (payload: { name: string; email: string; phone?: string; password: string; role: StaffRole }) =>
  api.post<StaffItem>('/admin/staff', payload);

export const updateStaff = (id: number, payload: Partial<Omit<StaffItem,'id'|'createdAt'|'phoneNumber'> & { phone?: string }>) =>
  api.patch<StaffItem>(`/admin/staff/${id}`, payload);

export const deleteStaff = (id: number) => api.delete(`/admin/staff/${id}`);

export const toggleActive = (id: number) => api.post<{ id: number; isActive: boolean }>(`/admin/staff/${id}/toggle-active`);
export const togglePublished = (id: number) => api.post<{ id: number; isPublished: boolean }>(`/admin/staff/${id}/toggle-published`);
