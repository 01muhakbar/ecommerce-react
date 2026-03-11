import { api } from "./axios.ts";

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeInvitationItem = (item: any) => {
  if (!item || typeof item !== "object") return null;
  const invitationState =
    normalizeText(item.invitationState ?? item.stateMeta?.code).toUpperCase() || "PENDING";

  return {
    memberId: asNumber(item.memberId, 0),
    status: normalizeText(item.status).toUpperCase() || "INVITED",
    membershipStatus:
      normalizeText(item.membershipStatus).toUpperCase() ||
      normalizeText(item.status).toUpperCase() ||
      "INVITED",
    statusMeta: item.statusMeta || null,
    invitationState,
    stateMeta: {
      code: invitationState,
      label:
        normalizeText(item.stateMeta?.label) ||
        (invitationState === "EXPIRED" ? "Expired invitation" : "Pending invitation"),
      description:
        normalizeText(item.stateMeta?.description) ||
        (invitationState === "EXPIRED"
          ? "This store invitation is no longer actionable. A store owner or admin must send it again."
          : "This store invitation is waiting for acceptance."),
    },
    roleCode: normalizeText(item.roleCode) || null,
    roleName: normalizeText(item.roleName) || null,
    invitedAt: item.invitedAt ?? null,
    acceptedAt: item.acceptedAt ?? null,
    expiresAt: item.expiresAt ?? null,
    isExpired:
      typeof item.isExpired === "boolean" ? item.isExpired : invitationState === "EXPIRED",
    isActionable:
      typeof item.isActionable === "boolean" ? item.isActionable : invitationState === "PENDING",
    store: item.store
      ? {
          id: asNumber(item.store.id, 0) || null,
          name: normalizeText(item.store.name) || null,
          slug: normalizeText(item.store.slug) || null,
          status: normalizeText(item.store.status).toUpperCase() || null,
        }
      : null,
    invitedBy: item.invitedBy
      ? {
          id: asNumber(item.invitedBy.id, 0) || null,
          name: normalizeText(item.invitedBy.name) || null,
          email: normalizeText(item.invitedBy.email) || null,
        }
      : null,
  };
};

export const getSellerInvitations = async () => {
  const { data } = await api.get("/seller/invitations");
  const payload = data?.data ?? null;

  return {
    items: Array.isArray(payload?.items)
      ? payload.items.map(normalizeInvitationItem).filter(Boolean)
      : [],
    total: asNumber(payload?.total, 0),
  };
};

export const acceptSellerInvitation = async (memberId: number | string) => {
  const { data } = await api.post(`/seller/invitations/${memberId}/accept`);
  return data ?? null;
};

export const declineSellerInvitation = async (memberId: number | string) => {
  const { data } = await api.post(`/seller/invitations/${memberId}/decline`);
  return data ?? null;
};
