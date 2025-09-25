import { create } from "zustand";
import { api } from "@/api/axios";

type User = { id: number; name: string; email: string; role: string };

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  setAuth: (v: { isAuthenticated: boolean; user: User; token: string; }) => void;
  logout: () => void;
  init: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  token: null,
  loading: true, // Start with loading true on app start

  setAuth: (values) => set({ ...values, loading: false }),

  logout: () => set({ isAuthenticated: false, user: null, token: null, loading: false }),

  init: async () => {
    try {
      console.log("AuthStore: Initializing session...");
      const { data } = await api.get("/auth/me");
      console.log("AuthStore: Session initialized successfully.", data.data.user);
      set({ isAuthenticated: true, user: data.data.user, token: null, loading: false });
    } catch (error: any) {
      console.error("AuthStore: Failed to initialize session.", error.response?.data || error.message);
      set({ isAuthenticated: false, user: null, token: null, loading: false });
    }
  },
}));