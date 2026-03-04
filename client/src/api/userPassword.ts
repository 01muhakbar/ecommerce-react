import { api } from "./axios";

export const changeUserPassword = async (payload: {
  currentPassword: string;
  newPassword: string;
}) => {
  const { data } = await api.post("/user/change-password", payload);
  return data;
};
