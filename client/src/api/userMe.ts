import { api } from "./axios";

export type UserMePayload = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address?: string | null;
  avatarUrl?: string | null;
};

const unwrap = (payload: any): UserMePayload => payload?.data ?? payload;

export const getUserMe = async () => {
  const { data } = await api.get("/user/me");
  return unwrap(data);
};

export const updateUserMe = async (payload: {
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
}) => {
  const { data } = await api.put("/user/me", payload);
  return unwrap(data);
};

export const uploadUserProfileImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = String(data?.data?.url || "").trim();
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};
