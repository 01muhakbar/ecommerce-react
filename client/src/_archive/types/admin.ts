export type Role = "admin" | "super_admin" | "editor" | "viewer";

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface Customer {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  createdAt: string; // ISO date
  updatedAt: string; // ISO date
}

export interface Order {
  id: number;
  customerId: number;
  status: "pending" | "processing" | "delivered" | "cancelled";
  total: number | string;
  createdAt: string;
  updatedAt: string;
}

export interface Staff {
  id: number;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type SettingsMap = Record<string, string>;
