import { api } from "./axios";

export async function login(payload) {
  const { data } = await api.post("/auth/admin/login", payload);
  return data;
}

export async function logout() {
  const { data } = await api.post("/auth/admin/logout");
  return data;
}

export async function me() {
  try {
    const { data } = await api.get("/auth/me");
    return data;
  } catch (error) {
    if (error?.response?.status === 401) {
      return null;
    }
    throw error;
  }
}
