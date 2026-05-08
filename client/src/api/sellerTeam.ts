import { api } from "./axios.ts";

const MEMBER_STATUSES = new Set(["ACTIVE", "DISABLED", "INVITED", "REMOVED"]);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizeMemberStatus = (value: unknown) => {
  const status = normalizeText(value).toUpperCase() || "DISABLED";
  return MEMBER_STATUSES.has(status) ? status : "DISABLED";
};

const buildStatusMeta = (status: string, fallback: any = {}) => ({
  ...fallback,
  code: status,
  label:
    status === "ACTIVE"
      ? "Active"
      : status === "DISABLED"
        ? "Disabled"
        : status === "INVITED"
          ? "Invited"
          : "Removed",
  description:
    status === "ACTIVE"
      ? "This membership currently has seller workspace access."
      : status === "DISABLED"
        ? "This membership stays recorded, but seller access is disabled."
        : status === "INVITED"
          ? "This membership is waiting for invitation acceptance."
          : "This membership is closed and cannot access the workspace.",
  isOperational: status === "ACTIVE" || status === "DISABLED",
});

const normalizeRole = (role: any, fallback: any = {}) => ({
  id: asNumber(role?.id ?? fallback?.id, 0) || null,
  code: normalizeText(role?.code ?? fallback?.code) || null,
  name: normalizeText(role?.name ?? fallback?.name) || null,
  description: normalizeText(role?.description ?? fallback?.description) || null,
  isActive:
    typeof role?.isActive === "boolean"
      ? role.isActive
      : typeof fallback?.isActive === "boolean"
        ? fallback.isActive
        : null,
  permissionKeys: Array.isArray(role?.permissionKeys)
    ? role.permissionKeys.map((entry: unknown) => normalizeText(entry)).filter(Boolean)
    : Array.isArray(fallback?.permissionKeys)
      ? fallback.permissionKeys
      : [],
});

const normalizeLifecycle = (lifecycle: any, fallback: any = {}) => ({
  invitedAt: lifecycle?.invitedAt ?? fallback?.invitedAt ?? null,
  acceptedAt: lifecycle?.acceptedAt ?? fallback?.acceptedAt ?? null,
  disabledAt: lifecycle?.disabledAt ?? fallback?.disabledAt ?? null,
  removedAt: lifecycle?.removedAt ?? fallback?.removedAt ?? null,
  removedSource: normalizeText(lifecycle?.removedSource ?? fallback?.removedSource) || null,
  removedSourceLabel:
    normalizeText(lifecycle?.removedSourceLabel ?? fallback?.removedSourceLabel) || null,
  lastRemovalAction:
    normalizeText(lifecycle?.lastRemovalAction ?? fallback?.lastRemovalAction) || null,
});

const normalizeInvitation = (invitation: any, fallbackStatus: string) => {
  if (fallbackStatus !== "INVITED" && (!invitation || typeof invitation !== "object")) {
    return null;
  }

  const state =
    normalizeText(invitation?.state).toUpperCase() ||
    (fallbackStatus === "INVITED" ? "PENDING" : null);

  if (!state) return null;

  return {
    state,
    label:
      normalizeText(invitation?.label) ||
      (state === "EXPIRED" ? "Expired invitation" : "Pending invitation"),
    description:
      normalizeText(invitation?.description) ||
      (state === "EXPIRED"
        ? "This store invitation is no longer actionable. A store owner or admin must send it again."
        : "This store invitation is waiting for the invited user to accept in the account lane."),
    invitedAt: invitation?.invitedAt ?? null,
    expiresAt: invitation?.expiresAt ?? null,
    isExpired:
      typeof invitation?.isExpired === "boolean" ? invitation.isExpired : state === "EXPIRED",
    isActionable:
      typeof invitation?.isActionable === "boolean"
        ? invitation.isActionable
        : state === "PENDING",
  };
};

const normalizeRoleReadModel = (payload: any, fallback: any = {}) => ({
  code: normalizeText(payload?.code ?? fallback?.code) || null,
  label: normalizeText(payload?.label ?? fallback?.label) || null,
  category: normalizeText(payload?.category) || null,
  authorityLevel: normalizeText(payload?.authorityLevel) || null,
  tone: normalizeText(payload?.tone) || "stone",
  summary: normalizeText(payload?.summary ?? fallback?.summary) || null,
});

const normalizeLifecycleReadModel = (payload: any, fallback: any = {}) => ({
  code: normalizeText(payload?.code) || null,
  label: normalizeText(payload?.label ?? fallback?.label) || null,
  tone: normalizeText(payload?.tone) || "stone",
  summary: normalizeText(payload?.summary ?? fallback?.summary) || null,
  nextStep: normalizeText(payload?.nextStep) || null,
});

const normalizeAuthorityReadModel = (payload: any) => ({
  code: normalizeText(payload?.code) || null,
  label: normalizeText(payload?.label) || null,
  tone: normalizeText(payload?.tone) || "stone",
  description: normalizeText(payload?.description) || null,
});

const normalizeMemberReadModel = (payload: any, fallback: any = {}) => ({
  primaryRole: normalizeRoleReadModel(payload?.primaryRole, fallback?.role),
  lifecycle: normalizeLifecycleReadModel(payload?.lifecycle, fallback?.statusMeta),
  authority: normalizeAuthorityReadModel(payload?.authority),
});

const normalizeCurrentAccessReadModel = (payload: any, fallback: any = {}) => ({
  primaryRole: normalizeRoleReadModel(payload?.primaryRole, {
    code: fallback?.roleCode,
    label: fallback?.roleCode,
  }),
  authority: normalizeAuthorityReadModel(payload?.authority),
  membershipBoundary: normalizeText(payload?.membershipBoundary) || null,
});

const normalizeAuditReadModel = (payload: any) => ({
  category: normalizeText(payload?.category) || null,
  title: normalizeText(payload?.title) || null,
  tone: normalizeText(payload?.tone) || "stone",
  summary: normalizeText(payload?.summary) || null,
  changeSummary: normalizeText(payload?.changeSummary) || null,
});

const normalizeMember = (member: any) => {
  if (!member || typeof member !== "object") return null;
  const status = normalizeMemberStatus(member.status ?? member.statusMeta?.code);
  return {
    ...member,
    id: asNumber(member.id, 0),
    userId: asNumber(member.userId, 0) || null,
    name: normalizeText(member.name) || `User #${asNumber(member.userId, 0) || "?"}`,
    email: normalizeText(member.email) || null,
    roleCode: normalizeText(member.roleCode) || null,
    roleName: normalizeText(member.roleName) || null,
    role: normalizeRole(member.role, {
      code: member.roleCode,
      name: member.roleName,
    }),
    status,
    statusMeta: buildStatusMeta(status, member.statusMeta),
    invitedAt: member.invitedAt ?? null,
    acceptedAt: member.acceptedAt ?? null,
    disabledAt: member.disabledAt ?? null,
    removedAt: member.removedAt ?? null,
    joinedAt: member.joinedAt ?? null,
    updatedAt: member.updatedAt ?? null,
    lifecycle: normalizeLifecycle(member.lifecycle, member),
    removedSource: normalizeText(member.removedSource) || null,
    removedSourceLabel: normalizeText(member.removedSourceLabel) || null,
    lastRemovalAction: normalizeText(member.lastRemovalAction) || null,
    invitation: normalizeInvitation(member.invitation, status),
    governance: {
      canViewLifecycle: Boolean(member.governance?.canViewLifecycle),
      canEditRole: Boolean(member.governance?.canEditRole),
      canToggleStatus: Boolean(member.governance?.canToggleStatus),
      canRemove: Boolean(member.governance?.canRemove),
      canReinvite: Boolean(member.governance?.canReinvite),
      isSelf: Boolean(member.governance?.isSelf),
      isOwner: Boolean(member.governance?.isOwner),
      restrictionReason: normalizeText(member.governance?.restrictionReason) || null,
    },
    readModel: normalizeMemberReadModel(member.readModel, {
      role: member.role,
      statusMeta: member.statusMeta,
    }),
  };
};

const normalizeHistoryItem = (item: any) => {
  if (!item || typeof item !== "object") return null;
  const beforeStatus = normalizeText(item.beforeState?.status).toUpperCase() || null;
  const afterStatus = normalizeText(item.afterState?.status).toUpperCase() || null;
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
          afterStatus ||
          beforeStatus ||
          null,
      },
    },
    beforeState: item.beforeState || null,
    afterState: item.afterState || null,
    readModel: normalizeAuditReadModel(item.readModel),
    createdAt: item.createdAt ?? null,
  };
};

export const getSellerTeamSummary = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/team`);
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") return null;

  return {
    ...payload,
    currentAccess: {
      ...payload.currentAccess,
      roleCode: normalizeText(payload.currentAccess?.roleCode) || null,
      membershipStatus: normalizeText(payload.currentAccess?.membershipStatus) || null,
      permissionKeys: Array.isArray(payload.currentAccess?.permissionKeys)
        ? payload.currentAccess.permissionKeys
            .map((entry: unknown) => normalizeText(entry))
            .filter(Boolean)
        : [],
      capabilities: {
        canViewTeam: Boolean(payload.currentAccess?.capabilities?.canViewTeam),
        canViewLifecycle: Boolean(payload.currentAccess?.capabilities?.canViewLifecycle),
        canViewAudit: Boolean(payload.currentAccess?.capabilities?.canViewAudit),
        canInviteMembers: Boolean(payload.currentAccess?.capabilities?.canInviteMembers),
        canAttachMembers: Boolean(payload.currentAccess?.capabilities?.canAttachMembers),
        canChangeRoles: Boolean(payload.currentAccess?.capabilities?.canChangeRoles),
        canChangeStatus: Boolean(payload.currentAccess?.capabilities?.canChangeStatus),
        canRemoveMembers: Boolean(payload.currentAccess?.capabilities?.canRemoveMembers),
        canReinviteMembers: Boolean(payload.currentAccess?.capabilities?.canReinviteMembers),
        manageableRoleCodes: Array.isArray(
          payload.currentAccess?.capabilities?.manageableRoleCodes
        )
          ? payload.currentAccess.capabilities.manageableRoleCodes
              .map((entry: unknown) => normalizeText(entry))
              .filter(Boolean)
          : [],
      },
      readModel: normalizeCurrentAccessReadModel(payload.currentAccess?.readModel, {
        roleCode: payload.currentAccess?.roleCode,
      }),
    },
    summary: {
      totalMembers: asNumber(payload.summary?.totalMembers, 0),
      activeMembers: asNumber(payload.summary?.activeMembers, 0),
      invitedMembers: asNumber(payload.summary?.invitedMembers, 0),
      disabledMembers: asNumber(payload.summary?.disabledMembers, 0),
      removedMembers: asNumber(payload.summary?.removedMembers, 0),
      hasVirtualOwnerBridge: Boolean(payload.summary?.hasVirtualOwnerBridge),
      systemRolesAvailable: asNumber(payload.summary?.systemRolesAvailable, 0),
    },
    members: Array.isArray(payload.members)
      ? payload.members.map(normalizeMember).filter(Boolean)
      : [],
    roles: Array.isArray(payload.roles)
      ? payload.roles.map((role: any) => normalizeRole(role)).filter(Boolean)
      : [],
  };
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
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") return null;

  return {
    ...payload,
    member: normalizeMember(payload.member),
    lifecycle: normalizeLifecycle(payload.lifecycle),
    history: {
      total: asNumber(payload.history?.total, 0),
      items: Array.isArray(payload.history?.items)
        ? payload.history.items.map(normalizeHistoryItem).filter(Boolean)
        : [],
    },
  };
};
