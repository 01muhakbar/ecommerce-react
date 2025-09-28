import { create } from "zustand";
import type { User } from "@/types/user";

type AuthState = {
  isAuthenticated: boolean;
  user: User | null;
  setAuth: (v: { isAuthenticated: boolean; user: User | null }) => void;
  clear: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,

  setAuth: (values) => set(values),

  clear: () => {
    set({
      isAuthenticated: false,
      user: null,
    });
  },
}));
