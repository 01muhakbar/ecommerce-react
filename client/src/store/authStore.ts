import { create } from 'zustand';

interface AuthState {
  isLoggedIn: boolean;
  user: { username: string; role: string } | null;
  login: (username: string, role: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  user: null,
  login: (username, role) => set({ isLoggedIn: true, user: { username, role } }),
  logout: () => set({ isLoggedIn: false, user: null }),
}));
