import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  name: string;
  role: string;
}

interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      token: null,
      login: (user, token) => {
        const normalizedUser = {
          ...user,
          role: (user.role ?? '').trim(),
        };
        set({ isLoggedIn: true, user: normalizedUser, token });
      },
      logout: () => set({ isLoggedIn: false, user: null, token: null }),
    }),
    {
      name: "auth-storage", // Nama item di localStorage
    }
  )
);
