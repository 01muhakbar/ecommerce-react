import { api } from "./axios";
import type { User } from "@/types/user";

export const getMe = async (): Promise<User> => {
  const response = await api.get<User>("/auth/me");
  return response.data;
};
