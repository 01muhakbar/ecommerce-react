import { api } from "./axios.ts";

export const getSellerInvitations = async () => {
  const { data } = await api.get("/seller/invitations");
  return data?.data ?? { items: [], total: 0 };
};

export const acceptSellerInvitation = async (memberId: number | string) => {
  const { data } = await api.post(`/seller/invitations/${memberId}/accept`);
  return data ?? null;
};

export const declineSellerInvitation = async (memberId: number | string) => {
  const { data } = await api.post(`/seller/invitations/${memberId}/decline`);
  return data ?? null;
};
