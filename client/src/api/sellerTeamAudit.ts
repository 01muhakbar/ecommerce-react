import { api } from "./axios.ts";

type SellerTeamAuditParams = {
  action?: string;
  page?: number;
  limit?: number;
};

export const getSellerTeamAudit = async (
  storeId: number | string,
  params: SellerTeamAuditParams = {}
) => {
  const search = new URLSearchParams();

  if (params.action) search.set("action", params.action);
  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));

  const suffix = search.toString() ? `?${search.toString()}` : "";
  const { data } = await api.get(`/seller/stores/${storeId}/team/audit${suffix}`);
  return data?.data ?? null;
};
