import { api } from "./axios";

export type AdminProfile = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  avatarUrl: string | null;
};

const unwrapProfile = (payload: any): AdminProfile => {
  const data = (payload?.data ?? payload) as AdminProfile & {
    avatar?: string | null;
    avatarUrl?: string | null;
  };
  const avatarUrl = data?.avatarUrl ?? data?.avatar ?? null;
  return {
    ...data,
    avatar: avatarUrl,
    avatarUrl,
  };
};

export const getAdminMe = async (): Promise<AdminProfile> => {
  const { data } = await api.get("/admin/me");
  return unwrapProfile(data);
};

export const updateAdminMe = async (input: {
  name: string;
  phone?: string | null;
  avatarUrl?: string | null;
}) => {
  const { data } = await api.put("/admin/me", input);
  return unwrapProfile(data);
};

export const uploadAdminProfileImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ url?: string }>("/admin/uploads", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = String(data?.url || "").trim();
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};
