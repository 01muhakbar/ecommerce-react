import { api } from "./axios";

export type AdminProfile = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
};

const unwrapProfile = (payload: any): AdminProfile => {
  return (payload?.data ?? payload) as AdminProfile;
};

export const getAdminMe = async (): Promise<AdminProfile> => {
  const { data } = await api.get("/admin/me");
  return unwrapProfile(data);
};

export const updateAdminMe = async (input: { name: string; phone?: string | null }) => {
  const { data } = await api.put("/admin/me", input);
  return unwrapProfile(data);
};
