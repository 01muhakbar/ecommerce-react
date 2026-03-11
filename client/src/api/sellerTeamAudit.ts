import { api } from "./axios.ts";

type SellerTeamAuditParams = {
  action?: string;
  page?: number;
  limit?: number;
};

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeAuditItem = (item: any) => {
  if (!item || typeof item !== "object") return null;
  return {
    ...item,
    id: asNumber(item.id, 0),
    action: normalizeText(item.action) || null,
    actionMeta: item.actionMeta || null,
    actor: item.actor
      ? {
          id: asNumber(item.actor.id, 0) || null,
          name: normalizeText(item.actor.name) || null,
          email: normalizeText(item.actor.email) || null,
        }
      : null,
    target: {
      user: item.target?.user
        ? {
            id: asNumber(item.target.user.id, 0) || null,
            name: normalizeText(item.target.user.name) || null,
            email: normalizeText(item.target.user.email) || null,
          }
        : null,
      memberId: asNumber(item.target?.memberId, 0) || null,
      roleCode: normalizeText(item.target?.roleCode) || null,
      roleName: normalizeText(item.target?.roleName) || null,
      snapshot: {
        roleCode:
          normalizeText(item.target?.snapshot?.roleCode) ||
          normalizeText(item.afterState?.roleCode) ||
          normalizeText(item.beforeState?.roleCode) ||
          normalizeText(item.target?.roleCode) ||
          null,
        roleName:
          normalizeText(item.target?.snapshot?.roleName) ||
          normalizeText(item.target?.roleName) ||
          null,
        status:
          normalizeText(item.target?.snapshot?.status).toUpperCase() ||
          normalizeText(item.afterState?.status).toUpperCase() ||
          normalizeText(item.beforeState?.status).toUpperCase() ||
          null,
      },
    },
    beforeState: item.beforeState || null,
    afterState: item.afterState || null,
    createdAt: item.createdAt ?? null,
  };
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
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") return null;

  return {
    ...payload,
    items: Array.isArray(payload.items)
      ? payload.items.map(normalizeAuditItem).filter(Boolean)
      : [],
    actionOptions: Array.isArray(payload.actionOptions)
      ? payload.actionOptions.map((entry: unknown) => normalizeText(entry)).filter(Boolean)
      : [],
    pagination: {
      page: asNumber(payload.pagination?.page, asNumber(params.page, 1)),
      limit: asNumber(payload.pagination?.limit, asNumber(params.limit, 10)),
      total: asNumber(payload.pagination?.total, 0),
      totalPages: asNumber(payload.pagination?.totalPages, 1),
    },
  };
};
