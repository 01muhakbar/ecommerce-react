import { api } from "./axios";

export type UserAddressMarkAs = "HOME" | "OFFICE";

export type UserAddressPayload = {
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  streetName: string;
  building?: string;
  houseNumber: string;
  otherDetails?: string;
  markAs: UserAddressMarkAs;
  isPrimary: boolean;
  isStore: boolean;
  isReturn: boolean;
};

export type UserAddress = UserAddressPayload & {
  id: number;
  userId: number;
  building?: string | null;
  otherDetails?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

const unwrap = <T = any>(payload: any): T => payload?.data ?? payload;

export const listAddresses = async () => {
  const { data } = await api.get("/user/addresses");
  const payload = unwrap<{ items?: UserAddress[] }>(data);
  return Array.isArray(payload?.items) ? payload.items : [];
};

export const getDefaultAddress = async () => {
  const { data } = await api.get("/user/addresses/default");
  return unwrap<UserAddress | null>(data) ?? null;
};

export const createAddress = async (payload: UserAddressPayload) => {
  const { data } = await api.post("/user/addresses", payload);
  return unwrap<UserAddress>(data);
};

export const updateAddress = async (id: number, payload: UserAddressPayload) => {
  const { data } = await api.put(`/user/addresses/${id}`, payload);
  return unwrap<UserAddress>(data);
};

export const deleteAddress = async (id: number) => {
  const { data } = await api.delete(`/user/addresses/${id}`);
  return data;
};
