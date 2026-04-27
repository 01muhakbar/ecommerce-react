import { api } from "./axios";

export async function adminLogin(payload) {
  const { data } = await api.post("/auth/admin/login", payload);
  return data;
}

export async function adminLogout() {
  const { data } = await api.post("/auth/admin/logout");
  return data;
}

export async function adminMe() {
  try {
    const { data } = await api.get("/auth/admin/me");
    return data;
  } catch (error) {
    if (error?.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function accountLogout() {
  const { data } = await api.post("/auth/logout");
  return data;
}

export async function accountMe() {
  try {
    const { data } = await api.get("/auth/account/me");
    return data;
  } catch (error) {
    if (error?.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export const login = adminLogin;
export const logout = adminLogout;
export const me = adminMe;
