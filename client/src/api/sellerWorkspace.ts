import { api } from "./axios.ts";

export type SellerWorkspaceContext = {
  store: {
    id: number;
    name: string;
    slug: string;
    status: string;
  };
  access: {
    accessMode: "OWNER_BRIDGE" | "MEMBER";
    roleCode: string;
    permissionKeys: string[];
    membershipStatus: string;
    isOwner: boolean;
    memberId: number | null;
  };
};

export const getSellerWorkspaceContext = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/context`);
  return (data?.data ?? null) as SellerWorkspaceContext | null;
};

export const getSellerWorkspaceContextBySlug = async (storeSlug: string) => {
  const { data } = await api.get(
    `/seller/stores/slug/${encodeURIComponent(String(storeSlug || "").trim())}/context`
  );
  return (data?.data ?? null) as SellerWorkspaceContext | null;
};
