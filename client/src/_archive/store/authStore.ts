// client/src/store/authStore.ts
import { create } from "zustand";

export type Role = "User" | "Admin" | "Manager" | "Staff" | "Super Admin";

export type User = {
  id: number;
  name: string;
  email: string;
  status: string;
  role: Role;
  routes?: string[];
};

type AuthState = {
  user: User | null;
  loading: boolean;
  actions: {
    setUser: (u: User | null) => void;
    clearUser: () => void;
  };
};

// Optional: jika kamu punya helper normalizeRole di tempat lain, bisa dipakai di setUser.
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  actions: {
    setUser: (u) => set({ user: u }),
    clearUser: () => set({ user: null }),
  },
}));
