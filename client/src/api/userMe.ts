import { api } from "./axios";

export type UserMePayload = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  address?: string | null;
};

const unwrap = (payload: any): UserMePayload => payload?.data ?? payload;

export const getUserMe = async () => {
  const { data } = await api.get("/user/me");
  return unwrap(data);
};

export const updateUserMe = async (payload: { name: string; phone?: string | null }) => {
  const { data } = await api.put("/user/me", payload);
  return unwrap(data);
};
