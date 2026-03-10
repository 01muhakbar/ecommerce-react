import { api } from "./axios.ts";

export const getSellerTeamSummary = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/team`);
  return data?.data ?? null;
};

export const createSellerStoreMember = async (
  storeId: number | string,
  payload: { email: string; roleCode: string }
) => {
  const { data } = await api.post(`/seller/stores/${storeId}/members`, payload);
  return data ?? null;
};

export const inviteSellerStoreMember = async (
  storeId: number | string,
  payload: { email: string; roleCode: string }
) => {
  const { data } = await api.post(`/seller/stores/${storeId}/members/invite`, payload);
  return data ?? null;
};

export const reinviteSellerStoreMember = async (
  storeId: number | string,
  memberId: number | string,
  payload: { roleCode: string }
) => {
  const { data } = await api.post(
    `/seller/stores/${storeId}/members/${memberId}/reinvite`,
    payload
  );
  return data ?? null;
};

export const updateSellerStoreMemberRole = async (
  storeId: number | string,
  memberId: number | string,
  payload: { roleCode: string }
) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/members/${memberId}/role`, payload);
  return data ?? null;
};

export const updateSellerStoreMemberStatus = async (
  storeId: number | string,
  memberId: number | string,
  payload: { status: "ACTIVE" | "DISABLED" }
) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/members/${memberId}/status`, payload);
  return data ?? null;
};

export const removeSellerStoreMember = async (
  storeId: number | string,
  memberId: number | string
) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/members/${memberId}/remove`);
  return data ?? null;
};

export const getSellerStoreMemberLifecycle = async (
  storeId: number | string,
  memberId: number | string
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/members/${memberId}/lifecycle`);
  return data?.data ?? null;
};
