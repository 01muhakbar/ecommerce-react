import { Router } from "express";
import { Op } from "sequelize";
import { z } from "zod";
import requireAuth from "../middleware/requireAuth.js";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Store, StoreAuditLog, StoreMember, StoreRole, User } from "../models/index.js";
import { getPermissionKeysForSellerRole } from "../services/seller/permissionMap.js";
import { SELLER_TEAM_AUDIT_ACTIONS, recordSellerTeamAudit } from "../services/seller/teamAudit.js";
import {
  buildTeamMutationError,
  canAssignRole,
  canManageRole,
  findUserByEmail,
  getAttr,
  loadStoreMemberById,
  loadStoreMemberByUserId,
  listStoreMembersForTeam,
  resolveStoreRoleByCode,
  isSellerInvitationExpired,
  serializeSellerInvitationState,
  SELLER_TEAM_STATUS_CONTRACT,
  serializeStoreMember,
  serializeTeamMutationEnvelope,
  SELLER_TEAM_API_STATUS,
  SELLER_TEAM_PERSISTENCE_STATUS,
  isPhase1OperationalStatus,
  toMemberDbStatus,
  toTeamStatus,
} from "../services/seller/teamMutations.js";

const router = Router();

const createMemberSchema = z.object({
  email: z.string().trim().email().max(160),
  roleCode: z.string().trim().min(3).max(64),
});

const updateMemberRoleSchema = z.object({
  roleCode: z.string().trim().min(3).max(64),
});

const updateMemberStatusSchema = z.object({
  status: z.enum([SELLER_TEAM_API_STATUS.ACTIVE, SELLER_TEAM_API_STATUS.DISABLED]),
});

const teamAuditQuerySchema = z.object({
  action: z
    .enum([
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE,
      SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
    ])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

const serializeRole = (role: any) => {
  const roleCode = String(getAttr(role, "code") || "");
  return {
    id: Number(getAttr(role, "id")),
    code: roleCode,
    name: String(getAttr(role, "name") || ""),
    description: getAttr(role, "description")
      ? String(getAttr(role, "description"))
      : null,
    isSystem: Boolean(getAttr(role, "isSystem")),
    isActive: Boolean(getAttr(role, "isActive")),
    permissionKeys: getPermissionKeysForSellerRole(roleCode),
  };
};

function serializeActionMeta(action: string) {
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE) {
    return { label: "Invitation created", tone: "amber" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT) {
    return { label: "Invitation accepted", tone: "emerald" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE) {
    return { label: "Invitation declined", tone: "stone" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE) {
    return { label: "Invitation sent again", tone: "amber" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH) {
    return { label: "Member attached directly", tone: "emerald" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE) {
    return { label: "Role changed", tone: "sky" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE) {
    return { label: "Member disabled", tone: "amber" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE) {
    return { label: "Member reactivated", tone: "emerald" };
  }
  if (action === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE) {
    return { label: "Member removed by store", tone: "rose" };
  }
  return { label: action || "Recorded action", tone: "stone" };
}

function serializeAuditSnapshot(beforeState: any, afterState: any, targetMember: any) {
  const targetRole = targetMember?.role ?? targetMember?.get?.("role") ?? null;
  const currentRoleCode = targetRole ? String(getAttr(targetRole, "code") || "") : null;
  const currentRoleName = targetRole ? String(getAttr(targetRole, "name") || "") : null;
  const snapshotRoleCode =
    String(afterState?.roleCode || beforeState?.roleCode || currentRoleCode || "").trim() || null;
  const snapshotStatus =
    String(afterState?.status || beforeState?.status || getAttr(targetMember, "status") || "")
      .trim()
      .toUpperCase() || null;

  return {
    roleCode: snapshotRoleCode,
    roleName:
      snapshotRoleCode && currentRoleCode === snapshotRoleCode
        ? currentRoleName
        : snapshotRoleCode
          ? String(snapshotRoleCode)
          : null,
    status: snapshotStatus,
    currentRoleCode,
    currentRoleName,
  };
}

function buildTeamCapabilities(args: {
  sellerAccess: any;
  manageableRoleOptions: any[];
}) {
  const permissionKeys = Array.isArray(args.sellerAccess?.permissionKeys)
    ? args.sellerAccess.permissionKeys
    : [];
  const canManageMembers = permissionKeys.includes("STORE_MEMBERS_MANAGE");
  const canManageRoles = permissionKeys.includes("STORE_ROLES_MANAGE");
  const manageableRoleCodes = args.manageableRoleOptions.map((role) => String(role.code || ""));

  return {
    canViewTeam: canManageMembers,
    canViewLifecycle: canManageMembers,
    canViewAudit: permissionKeys.includes("AUDIT_LOG_VIEW"),
    canInviteMembers: canManageMembers && canManageRoles && manageableRoleCodes.length > 0,
    canAttachMembers: canManageMembers && canManageRoles && manageableRoleCodes.length > 0,
    canChangeRoles: canManageMembers && canManageRoles,
    canChangeStatus: canManageMembers,
    canRemoveMembers: canManageMembers,
    canReinviteMembers: canManageMembers && canManageRoles,
    manageableRoleCodes,
  };
}

function getActorUserId(req: any) {
  return Number(req?.user?.id || 0) || null;
}

function isOwnerUserTarget(args: {
  sellerAccess: any;
  targetUserId: number | null | undefined;
}) {
  const ownerUserId = Number(args.sellerAccess?.store?.ownerUserId || 0) || null;
  const targetUserId = Number(args.targetUserId || 0) || null;
  return ownerUserId !== null && targetUserId !== null && ownerUserId === targetUserId;
}

function buildMemberGovernance(args: {
  sellerAccess: any;
  member: any;
}) {
  const serializedMember = serializeStoreMember(args.member) as any;
  const actorRoleCode = String(args.sellerAccess?.roleCode || "");
  const actorMemberId = Number(args.sellerAccess?.memberId || 0) || null;
  const permissionKeys = Array.isArray(args.sellerAccess?.permissionKeys)
    ? args.sellerAccess.permissionKeys
    : [];
  const canManageMembers = permissionKeys.includes("STORE_MEMBERS_MANAGE");
  const canManageRoles = permissionKeys.includes("STORE_ROLES_MANAGE");
  const currentStatus = String(serializedMember.status || "").toUpperCase();
  const isExpiredInvitation =
    currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.INVITED &&
    String(serializedMember.invitation?.state || "").toUpperCase() === "EXPIRED";
  const roleCode = String(serializedMember.roleCode || "");
  const isSelf = actorMemberId !== null && Number(serializedMember.id) === actorMemberId;
  const isOwner =
    roleCode === "STORE_OWNER" ||
    isOwnerUserTarget({
      sellerAccess: args.sellerAccess,
      targetUserId: Number(serializedMember.userId || 0) || null,
    });
  const manageableTarget = canManageRole({
    actorRoleCode,
    targetRoleCode: roleCode,
  });
  const canEditRole =
    canManageMembers &&
    canManageRoles &&
    !isSelf &&
    !isOwner &&
    currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.REMOVED &&
    manageableTarget;
  const canToggleStatus =
    canManageMembers &&
    !isSelf &&
    !isOwner &&
    manageableTarget &&
    [SELLER_TEAM_API_STATUS.ACTIVE, SELLER_TEAM_API_STATUS.DISABLED].includes(currentStatus as any);
  const canRemove =
    canManageMembers &&
    !isSelf &&
    !isOwner &&
    manageableTarget &&
    (actorRoleCode !== "STORE_ADMIN" || roleCode !== "STORE_ADMIN") &&
    [SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE, SELLER_TEAM_PERSISTENCE_STATUS.DISABLED].includes(
      currentStatus as any
    );
  const canReinvite =
    canManageMembers &&
    canManageRoles &&
    !isSelf &&
    !isOwner &&
    manageableTarget &&
    (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED || isExpiredInvitation);

  let restrictionReason = null;
  if (isSelf) restrictionReason = "Self mutation is blocked by backend.";
  else if (isOwner) restrictionReason = "Store owner is protected in this phase.";
  else if (!canManageMembers)
    restrictionReason = "This actor cannot manage seller store members.";
  else if (
    actorRoleCode === "STORE_ADMIN" &&
    roleCode === "STORE_ADMIN" &&
    currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.REMOVED
  ) {
    restrictionReason = "Store admin cannot mutate another active store admin in this phase.";
  } else if (!manageableTarget) {
    restrictionReason = "Current seller role cannot manage this target role.";
  } else if (isExpiredInvitation) {
    restrictionReason =
      "This invitation expired. Only an authorized store operator can send it again.";
  } else if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.INVITED) {
    restrictionReason =
      "Invitation rows can still have role adjustments, but activation and removal stay closed here.";
  } else if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
    restrictionReason = canReinvite
      ? "Removed memberships can only change role while being reopened through re-invite."
      : "Removed memberships can only be reopened through re-invite when allowed.";
  }

  return {
    canViewLifecycle: canManageMembers,
    canEditRole,
    canToggleStatus,
    canRemove,
    canReinvite,
    isSelf,
    isOwner,
    restrictionReason,
  };
}

function parseAuditState(value: unknown) {
  if (!value) return null;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
}

function serializeAuditActor(user: any) {
  if (!user) return null;
  return {
    id: Number(getAttr(user, "id")),
    name: String(getAttr(user, "name") || ""),
    email: String(getAttr(user, "email") || ""),
  };
}

function serializeTeamAuditRow(log: any) {
  const actorUser = log?.actorUser ?? log?.get?.("actorUser") ?? null;
  const targetUser = log?.targetUser ?? log?.get?.("targetUser") ?? null;
  const targetMember = log?.targetMember ?? log?.get?.("targetMember") ?? null;
  const targetRole = targetMember?.role ?? targetMember?.get?.("role") ?? null;
  const beforeState = parseAuditState(getAttr(log, "beforeState"));
  const afterState = parseAuditState(getAttr(log, "afterState"));
  const action = String(getAttr(log, "action") || "");

  return {
    id: Number(getAttr(log, "id")),
    action,
    actionMeta: serializeActionMeta(action),
    actor: serializeAuditActor(actorUser),
    target: {
      user: serializeAuditActor(targetUser),
      memberId: targetMember ? Number(getAttr(targetMember, "id")) : null,
      roleCode: targetRole ? String(getAttr(targetRole, "code") || "") : null,
      roleName: targetRole ? String(getAttr(targetRole, "name") || "") : null,
      snapshot: serializeAuditSnapshot(beforeState, afterState, targetMember),
    },
    beforeState,
    afterState,
    createdAt: getAttr(log, "createdAt") || null,
  };
}

function getRemovedSourceFromAction(action: unknown) {
  const normalized = String(action || "").toUpperCase();
  if (normalized === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE) {
    return "INVITE_DECLINE";
  }
  if (normalized === SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE) {
    return "OPERATIONAL_REMOVE";
  }
  return null;
}

function getRemovedSourceLabel(source: unknown) {
  const normalized = String(source || "").toUpperCase();
  if (normalized === "INVITE_DECLINE") {
    return "Invite declined";
  }
  if (normalized === "OPERATIONAL_REMOVE") {
    return "Removed by store";
  }
  return null;
}

async function buildRemovedSourceMap(storeId: number, memberIds: number[]) {
  if (!memberIds.length) return new Map<number, { source: string | null; action: string | null }>();

  const logs = await StoreAuditLog.findAll({
    where: {
      storeId,
      targetMemberId: {
        [Op.in]: memberIds,
      },
      action: {
        [Op.in]: [
          SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
          SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
        ],
      },
    } as any,
    attributes: ["id", "targetMemberId", "action", "createdAt"],
    order: [
      ["targetMemberId", "ASC"],
      ["createdAt", "DESC"],
    ],
  });

  const map = new Map<number, { source: string | null; action: string | null }>();
  for (const log of logs) {
    const memberId = Number(getAttr(log, "targetMemberId"));
    if (!memberId || map.has(memberId)) continue;
    const action = String(getAttr(log, "action") || "");
    map.set(memberId, {
      source: getRemovedSourceFromAction(action),
      action,
    });
  }
  return map;
}

function serializeInvitationActor(user: any) {
  if (!user) return null;
  return {
    id: Number(getAttr(user, "id")),
    name: String(getAttr(user, "name") || ""),
    email: String(getAttr(user, "email") || ""),
  };
}

function serializeInvitationRow(member: any) {
  const store = member?.store ?? member?.get?.("store") ?? null;
  const role = member?.role ?? member?.get?.("role") ?? null;
  const invitedByUser = member?.invitedByUser ?? member?.get?.("invitedByUser") ?? null;
  const serializedMember = serializeStoreMember(member) as any;
  const invitation = serializedMember.invitation ?? serializeSellerInvitationState(member);

  return {
    memberId: Number(getAttr(member, "id")),
    status: serializedMember.status,
    statusMeta: serializedMember.statusMeta,
    membershipStatus: serializedMember.status,
    invitationState: String(invitation?.state || "PENDING"),
    stateMeta: invitation
      ? {
          code: invitation.state,
          label: invitation.label,
          description: invitation.description,
        }
      : null,
    roleCode: role ? String(getAttr(role, "code") || "") : "",
    roleName: role ? String(getAttr(role, "name") || "") : "",
    invitedAt: serializedMember.invitedAt,
    acceptedAt: serializedMember.acceptedAt,
    expiresAt: invitation?.expiresAt || null,
    isExpired: Boolean(invitation?.isExpired),
    isActionable: Boolean(invitation?.isActionable),
    store: store
      ? {
          id: Number(getAttr(store, "id")),
          name: String(getAttr(store, "name") || ""),
          slug: String(getAttr(store, "slug") || ""),
          status: String(getAttr(store, "status") || "ACTIVE"),
        }
      : null,
    invitedBy: serializeInvitationActor(invitedByUser),
  };
}

router.get("/invitations", requireAuth, async (req, res) => {
  try {
    const userId = Number((req as any).user?.id || 0);
    const invitations = await StoreMember.findAll({
      where: {
        userId,
        status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
      } as any,
      attributes: [
        "id",
        "storeId",
        "userId",
        "storeRoleId",
        "status",
        "invitedAt",
        "invitedByUserId",
        "acceptedAt",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: true,
        },
        {
          model: StoreRole,
          as: "role",
          attributes: ["id", "code", "name"],
          required: false,
        },
        {
          model: User,
          as: "invitedByUser",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["invitedAt", "DESC"]],
    });

    return res.json({
      success: true,
      data: {
        items: invitations.map(serializeInvitationRow),
        total: invitations.length,
      },
    });
  } catch (error) {
    console.error("[seller/invitations:list] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load seller invitations.",
    });
  }
});

router.post("/invitations/:memberId/accept", requireAuth, async (req, res) => {
  try {
    const memberId = Number(req.params.memberId);
    const userId = Number((req as any).user?.id || 0);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return buildTeamMutationError(
        res,
        400,
        "INVALID_MEMBER_ID",
        "Invalid invitation member id."
      );
    }

    const member = await StoreMember.findOne({
      where: { id: memberId, userId } as any,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: true,
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: StoreRole,
          as: "role",
          attributes: ["id", "code", "name", "isActive"],
          required: false,
        },
      ],
    });

    if (!member) {
      return buildTeamMutationError(
        res,
        404,
        "INVITATION_NOT_FOUND",
        "Invitation not found."
      );
    }

    const currentStatus = String(getAttr(member, "status") || "").toUpperCase();
    if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_ALREADY_ACCEPTED",
        "This invitation has already been accepted."
      );
    }

    if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_ALREADY_DECLINED",
        "This invitation has already been declined or closed."
      );
    }

    if (isSellerInvitationExpired(getAttr(member, "invitedAt"))) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_EXPIRED",
        "This invitation has expired. Ask the store owner or admin to send it again."
      );
    }

    if (currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.INVITED) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_STATUS_INVALID",
        "Only pending invited memberships can be accepted."
      );
    }

    const acceptedAt = new Date();
    await (member as any).update({
      status: SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE,
      acceptedAt,
      disabledAt: null,
      disabledByUserId: null,
      removedAt: null,
      removedByUserId: null,
    });

    const refreshed = await StoreMember.findOne({
      where: { id: memberId, userId } as any,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: true,
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: StoreRole,
          as: "role",
          attributes: ["id", "code", "name", "isActive"],
          required: false,
        },
      ],
    });

    const auditLog = await recordSellerTeamAudit({
      storeId: Number(getAttr(refreshed, "storeId")),
      actorUserId: userId,
      targetUserId: userId,
      targetMemberId: Number(getAttr(refreshed, "id")),
      action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT,
      beforeState: {
        roleCode: String(getAttr((member as any).role, "code") || ""),
        status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
      },
      afterState: {
        roleCode: String(getAttr((refreshed as any)?.role, "code") || ""),
        status: SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE,
      },
    });

    return res.json({
      success: true,
      message: "Store invitation accepted.",
      data: {
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT,
        member: serializeStoreMember(refreshed),
        store: refreshed ? serializeInvitationRow(refreshed).store : null,
        auditLogId: Number((auditLog as any)?.id || 0) || null,
        invitation: {
          previousState: "PENDING",
          nextState: "ACCEPTED",
        },
        membershipTransition: {
          from: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
          to: SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE,
        },
        acceptedAt,
      },
    });
  } catch (error) {
    console.error("[seller/invitations:accept] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to accept seller invitation.",
    });
  }
});

router.post("/invitations/:memberId/decline", requireAuth, async (req, res) => {
  try {
    const memberId = Number(req.params.memberId);
    const userId = Number((req as any).user?.id || 0);

    if (!Number.isInteger(memberId) || memberId <= 0) {
      return buildTeamMutationError(
        res,
        400,
        "INVALID_MEMBER_ID",
        "Invalid invitation member id."
      );
    }

    const member = await StoreMember.findOne({
      where: { id: memberId, userId } as any,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: true,
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: StoreRole,
          as: "role",
          attributes: ["id", "code", "name", "isActive"],
          required: false,
        },
      ],
    });

    if (!member) {
      return buildTeamMutationError(
        res,
        404,
        "INVITATION_NOT_FOUND",
        "Invitation not found."
      );
    }

    const currentStatus = String(getAttr(member, "status") || "").toUpperCase();
    if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_ALREADY_DECLINED",
        "This invitation has already been declined."
      );
    }

    if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_ALREADY_ACCEPTED",
        "This invitation has already been accepted."
      );
    }

    if (isSellerInvitationExpired(getAttr(member, "invitedAt"))) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_EXPIRED",
        "This invitation has expired. Ask the store owner or admin to send it again."
      );
    }

    if (currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.INVITED) {
      return buildTeamMutationError(
        res,
        409,
        "INVITATION_STATUS_INVALID",
        "Only pending invited memberships can be declined."
      );
    }

    const removedAt = new Date();
    await (member as any).update({
      status: SELLER_TEAM_PERSISTENCE_STATUS.REMOVED,
      removedAt,
      removedByUserId: userId,
      disabledAt: null,
      disabledByUserId: null,
    });

    const refreshed = await StoreMember.findOne({
      where: { id: memberId, userId } as any,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: true,
        },
        {
          model: User,
          as: "user",
          attributes: ["id", "name", "email"],
          required: false,
        },
        {
          model: StoreRole,
          as: "role",
          attributes: ["id", "code", "name", "isActive"],
          required: false,
        },
      ],
    });

    const auditLog = await recordSellerTeamAudit({
      storeId: Number(getAttr(refreshed, "storeId")),
      actorUserId: userId,
      targetUserId: userId,
      targetMemberId: Number(getAttr(refreshed, "id")),
      action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
      beforeState: {
        roleCode: String(getAttr((member as any).role, "code") || ""),
        status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
      },
      afterState: {
        roleCode: String(getAttr((refreshed as any)?.role, "code") || ""),
        status: SELLER_TEAM_PERSISTENCE_STATUS.REMOVED,
      },
    });

    return res.json({
      success: true,
      message: "Store invitation declined.",
      data: {
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
        member: serializeStoreMember(refreshed),
        store: refreshed ? serializeInvitationRow(refreshed).store : null,
        auditLogId: Number((auditLog as any)?.id || 0) || null,
        invitation: {
          previousState: "PENDING",
          nextState: "DECLINED",
        },
        membershipTransition: {
          from: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
          to: SELLER_TEAM_PERSISTENCE_STATUS.REMOVED,
        },
        removedAt,
      },
    });
  } catch (error) {
    console.error("[seller/invitations:decline] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to decline seller invitation.",
    });
  }
});

router.get(
  "/stores/:storeId/team/audit",
  requireSellerStoreAccess(["AUDIT_LOG_VIEW"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const parsed = teamAuditQuerySchema.safeParse(req.query);

      if (!parsed.success) {
        return buildTeamMutationError(
          res,
          400,
          "INVALID_AUDIT_QUERY",
          "Invalid team audit query."
        );
      }

      const { action, page, limit } = parsed.data;
      const offset = (page - 1) * limit;
      const where: Record<string, unknown> = { storeId };

      if (action) {
        where.action = action;
      } else {
        where.action = {
          [Op.in]: [
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
          ],
        };
      }

      const result = await StoreAuditLog.findAndCountAll({
        where: where as any,
        attributes: [
          "id",
          "storeId",
          "actorUserId",
          "targetUserId",
          "targetMemberId",
          "action",
          "beforeState",
          "afterState",
          "createdAt",
        ],
        include: [
          {
            model: User,
            as: "actorUser",
            attributes: ["id", "name", "email"],
            required: false,
          },
          {
            model: User,
            as: "targetUser",
            attributes: ["id", "name", "email"],
            required: false,
          },
          {
            model: StoreMember,
            as: "targetMember",
            attributes: ["id", "userId", "storeRoleId", "status"],
            required: false,
            include: [
              {
                model: StoreRole,
                as: "role",
                attributes: ["id", "code", "name"],
                required: false,
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit,
        offset,
      });

      return res.json({
        success: true,
        data: {
          items: result.rows.map(serializeTeamAuditRow),
          pagination: {
            page,
            limit,
            total: Number(result.count || 0),
            totalPages: Math.max(1, Math.ceil(Number(result.count || 0) / limit)),
          },
          filters: {
            action: action || null,
          },
          actionOptions: [
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE,
            SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
          ],
        },
      });
    } catch (error) {
      console.error("[seller/team:audit] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller team audit logs.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/team",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);

      const [members, roles] = await Promise.all([
        listStoreMembersForTeam(storeId),
        StoreRole.findAll({
          where: { isActive: true } as any,
          attributes: ["id", "code", "name", "description", "isSystem", "isActive"],
          order: [
            ["isSystem", "DESC"],
            ["name", "ASC"],
          ],
        }),
      ]);
      const serializedRoles = roles.map(serializeRole);
      const manageableRoleOptions = serializedRoles.filter((role) =>
        canAssignRole({
          actorRoleCode: sellerAccess.roleCode,
          nextRoleCode: role.code,
        })
      );
      const capabilities = buildTeamCapabilities({
        sellerAccess,
        manageableRoleOptions,
      });

      const removedMemberIds = members
        .filter(
          (member) =>
            toTeamStatus(getAttr(member, "status")) === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED
        )
        .map((member) => Number(getAttr(member, "id")))
        .filter((value) => Number.isInteger(value) && value > 0);

      const removedSourceMap = await buildRemovedSourceMap(storeId, removedMemberIds);

      return res.json({
        success: true,
        data: {
          store: {
            id: Number(sellerAccess.store.id),
            name: String(sellerAccess.store.name || ""),
            slug: String(sellerAccess.store.slug || ""),
            status: String(sellerAccess.store.status || "ACTIVE"),
          },
          currentAccess: {
            accessMode: sellerAccess.accessMode,
            roleCode: sellerAccess.roleCode,
            permissionKeys: sellerAccess.permissionKeys,
            membershipStatus: sellerAccess.membershipStatus,
            isOwner: Boolean(sellerAccess.isOwner),
            memberId: sellerAccess.memberId,
            storeRoleId: sellerAccess.storeRoleId,
            capabilities,
          },
          summary: {
            totalMembers: members.length,
            activeMembers: members.filter((member) => toTeamStatus(getAttr(member, "status")) === SELLER_TEAM_API_STATUS.ACTIVE).length,
            invitedMembers: members.filter((member) => toTeamStatus(getAttr(member, "status")) === SELLER_TEAM_PERSISTENCE_STATUS.INVITED).length,
            disabledMembers: members.filter((member) => toTeamStatus(getAttr(member, "status")) === SELLER_TEAM_API_STATUS.DISABLED).length,
            removedMembers: members.filter((member) => toTeamStatus(getAttr(member, "status")) === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED).length,
            hasVirtualOwnerBridge:
              sellerAccess.accessMode === "OWNER_BRIDGE" &&
              sellerAccess.membershipStatus === "VIRTUAL_OWNER",
            systemRolesAvailable: roles.filter((role) => Boolean(getAttr(role, "isSystem")))
              .length,
          },
          statusContract: SELLER_TEAM_STATUS_CONTRACT,
          members: members.map((member) => {
            const serialized = serializeStoreMember(member) as any;
            const removedMeta = removedSourceMap.get(serialized.id);
            return {
              ...serialized,
              removedSource: removedMeta?.source || null,
              removedSourceLabel: getRemovedSourceLabel(removedMeta?.source),
              lastRemovalAction: removedMeta?.action || null,
              governance: buildMemberGovernance({ sellerAccess, member }),
            };
          }),
          roles: serializedRoles,
        },
      });
    } catch (error) {
      console.error("[seller/team] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller team summary.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/members/invite",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE", "STORE_ROLES_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const sellerAccess = (req as any).sellerAccess;
      const parsed = createMemberSchema.safeParse(req.body);

      if (!parsed.success) {
        return buildTeamMutationError(
          res,
          400,
          "INVALID_MEMBER_PAYLOAD",
          "Invalid member payload."
        );
      }

      const email = String(parsed.data.email || "").trim().toLowerCase();
      const roleCode = String(parsed.data.roleCode || "").trim().toUpperCase();

      const [user, targetRole] = await Promise.all([
        findUserByEmail(email),
        resolveStoreRoleByCode(roleCode),
      ]);
      const actorUserId = getActorUserId(req);
      const targetUserId = Number((user as any)?.id || 0) || null;

      if (!user) {
        return buildTeamMutationError(
          res,
          404,
          "MEMBER_EMAIL_NOT_FOUND",
          "Only users with an existing account can be invited in this phase."
        );
      }

      if (!targetRole) {
        return buildTeamMutationError(res, 400, "INVALID_STORE_ROLE", "Invalid seller role.");
      }

      if (isOwnerUserTarget({ sellerAccess, targetUserId })) {
        return buildTeamMutationError(
          res,
          403,
          "OWNER_MUTATION_FORBIDDEN",
          "Store owner membership is managed through the owner bridge and cannot be invited here."
        );
      }

      if (targetUserId !== null && actorUserId !== null && targetUserId === actorUserId) {
        return buildTeamMutationError(
          res,
          403,
          "SELF_MUTATION_FORBIDDEN",
          "You cannot invite your own account into this store again."
        );
      }

      if (
        !canAssignRole({
          actorRoleCode: sellerAccess.roleCode,
          nextRoleCode: roleCode,
        })
      ) {
        return buildTeamMutationError(
          res,
          403,
          "ROLE_CHANGE_FORBIDDEN",
          "You do not have permission to assign this seller role."
        );
      }

      const existingMember = await loadStoreMemberByUserId(storeId, Number((user as any).id));

      if (existingMember) {
        const existingStatus = toTeamStatus(getAttr(existingMember, "status"));

        if (existingStatus === SELLER_TEAM_API_STATUS.ACTIVE) {
          return buildTeamMutationError(
            res,
            409,
            "MEMBER_ALREADY_ACTIVE",
            "This user is already an active store member."
          );
        }

        if (existingStatus === SELLER_TEAM_PERSISTENCE_STATUS.INVITED) {
          return buildTeamMutationError(
            res,
            409,
            "MEMBER_ALREADY_INVITED",
            "This user already has a pending store invitation."
          );
        }

        return buildTeamMutationError(
          res,
          409,
          "MEMBER_STATUS_TRANSITION_FORBIDDEN",
          existingStatus === SELLER_TEAM_API_STATUS.DISABLED
            ? "This user already belongs to the store and should use the reactivate flow."
            : "This membership needs a dedicated restore or future lifecycle flow."
        );
      }

      const now = new Date();
      const created = await StoreMember.create({
        storeId,
        userId: Number((user as any).id),
        storeRoleId: Number((targetRole as any).id),
        status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
        invitedByUserId: Number((req as any).user?.id || 0) || null,
        invitedAt: now,
        acceptedAt: null,
        disabledAt: null,
        disabledByUserId: null,
        removedAt: null,
        removedByUserId: null,
      } as any);

      const member = await loadStoreMemberById(storeId, Number((created as any).id));
      const auditLog = await recordSellerTeamAudit({
        storeId,
        actorUserId: Number((req as any).user?.id || 0) || null,
        targetUserId: Number((user as any).id),
        targetMemberId: Number((member as any)?.id || 0) || null,
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE,
        beforeState: null,
        afterState: {
          roleCode,
          status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
        },
      });

      return res.status(201).json(
        serializeTeamMutationEnvelope({
          action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE,
          member,
          auditLogId: Number((auditLog as any)?.id || 0) || null,
          message: "Existing user invited to this store.",
        })
      );
    } catch (error: any) {
      if (String(error?.name || "") === "SequelizeUniqueConstraintError") {
        return buildTeamMutationError(
          res,
          409,
          "DUPLICATE_STORE_MEMBER",
          "A store membership for this user already exists."
        );
      }

      console.error("[seller/team:invite-member] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to invite store member.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/members/:memberId/reinvite",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE", "STORE_ROLES_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const memberId = Number(req.params.memberId);
      const sellerAccess = (req as any).sellerAccess;
      const parsed = updateMemberRoleSchema.safeParse(req.body);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return buildTeamMutationError(res, 400, "INVALID_MEMBER_ID", "Invalid member id.");
      }

      if (!parsed.success) {
        return buildTeamMutationError(
          res,
          400,
          "INVALID_MEMBER_PAYLOAD",
          "Invalid member payload."
        );
      }

      const roleCode = String(parsed.data.roleCode || "").trim().toUpperCase();
      const [member, targetRole] = await Promise.all([
        loadStoreMemberById(storeId, memberId),
        resolveStoreRoleByCode(roleCode),
      ]);

      if (!member) {
        return buildTeamMutationError(res, 404, "MEMBER_NOT_FOUND", "Store member not found.");
      }

      if (!targetRole) {
        return buildTeamMutationError(res, 400, "INVALID_STORE_ROLE", "Invalid seller role.");
      }

      const currentRoleCode = String(getAttr((member as any).role, "code") || "");
      const currentStatus = String(getAttr(member, "status") || "").toUpperCase();
      const targetUserId = Number(getAttr(member, "userId")) || null;

      if (targetUserId !== null && targetUserId === getActorUserId(req)) {
        return buildTeamMutationError(
          res,
          403,
          "SELF_MUTATION_FORBIDDEN",
          "You cannot re-invite your own store membership."
        );
      }

      if (isOwnerUserTarget({ sellerAccess, targetUserId })) {
        return buildTeamMutationError(
          res,
          403,
          "OWNER_MUTATION_FORBIDDEN",
          "Store owner cannot be re-invited in this phase."
        );
      }

      if (
        !canManageRole({
          actorRoleCode: sellerAccess.roleCode,
          targetRoleCode: currentRoleCode,
        }) ||
        !canAssignRole({
          actorRoleCode: sellerAccess.roleCode,
          nextRoleCode: roleCode,
        })
      ) {
        return buildTeamMutationError(
          res,
          403,
          "ROLE_CHANGE_FORBIDDEN",
          "You do not have permission to re-invite this member with the requested role."
        );
      }

      if (
        currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.INVITED &&
        !isSellerInvitationExpired(getAttr(member, "invitedAt"))
      ) {
        return buildTeamMutationError(
          res,
          409,
          "MEMBER_ALREADY_INVITED",
          "This membership already has a pending invitation."
        );
      }

      if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE) {
        return buildTeamMutationError(
          res,
          409,
          "MEMBER_ALREADY_ACTIVE",
          "This membership is already active."
        );
      }

      const canReissueExpiredInvite =
        currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.INVITED &&
        isSellerInvitationExpired(getAttr(member, "invitedAt"));

      if (
        currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.REMOVED &&
        !canReissueExpiredInvite
      ) {
        return buildTeamMutationError(
          res,
          409,
          "MEMBER_STATUS_TRANSITION_FORBIDDEN",
          "Only removed or expired invited memberships can be re-issued in this phase."
        );
      }

      const invitedAt = new Date();
      await (member as any).update({
        storeRoleId: Number((targetRole as any).id),
        status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
        invitedByUserId: Number((req as any).user?.id || 0) || null,
        invitedAt,
        acceptedAt: null,
        disabledAt: null,
        disabledByUserId: null,
        removedAt: null,
        removedByUserId: null,
      });

      const refreshed = await loadStoreMemberById(storeId, memberId);
      const auditLog = await recordSellerTeamAudit({
        storeId,
        actorUserId: Number((req as any).user?.id || 0) || null,
        targetUserId: Number(getAttr(refreshed, "userId")),
        targetMemberId: Number(getAttr(refreshed, "id")),
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE,
        beforeState: {
          roleCode: currentRoleCode,
          status: currentStatus,
        },
        afterState: {
          roleCode,
          status: SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
        },
      });

      return res.json(
        serializeTeamMutationEnvelope({
          action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE,
          member: refreshed,
          auditLogId: Number((auditLog as any)?.id || 0) || null,
          message: "Member re-invited to this store.",
        })
      );
    } catch (error) {
      console.error("[seller/team:reinvite] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to re-invite store member.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/members",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE", "STORE_ROLES_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const sellerAccess = (req as any).sellerAccess;
      const parsed = createMemberSchema.safeParse(req.body);

      if (!parsed.success) {
        return buildTeamMutationError(
          res,
          400,
          "INVALID_MEMBER_PAYLOAD",
          "Invalid member payload."
        );
      }

      const email = String(parsed.data.email || "").trim().toLowerCase();
      const roleCode = String(parsed.data.roleCode || "").trim().toUpperCase();

      const [user, targetRole] = await Promise.all([
        findUserByEmail(email),
        resolveStoreRoleByCode(roleCode),
      ]);
      const actorUserId = getActorUserId(req);
      const targetUserId = Number((user as any)?.id || 0) || null;

      if (!user) {
        return buildTeamMutationError(res, 404, "MEMBER_EMAIL_NOT_FOUND", "No user with this email was found.");
      }

      if (!targetRole) {
        return buildTeamMutationError(res, 400, "INVALID_STORE_ROLE", "Invalid seller role.");
      }

      if (isOwnerUserTarget({ sellerAccess, targetUserId })) {
        return buildTeamMutationError(
          res,
          403,
          "OWNER_MUTATION_FORBIDDEN",
          "Store owner membership is managed through the owner bridge and cannot be attached here."
        );
      }

      if (targetUserId !== null && actorUserId !== null && targetUserId === actorUserId) {
        return buildTeamMutationError(
          res,
          403,
          "SELF_MUTATION_FORBIDDEN",
          "You cannot attach your own account into this store again."
        );
      }

      if (
        !canAssignRole({
          actorRoleCode: sellerAccess.roleCode,
          nextRoleCode: roleCode,
        })
      ) {
        return buildTeamMutationError(
          res,
          403,
          "ROLE_CHANGE_FORBIDDEN",
          "You do not have permission to assign this seller role."
        );
      }

      const existingMember = await loadStoreMemberByUserId(storeId, Number((user as any).id));

      if (existingMember) {
        const existingStatus = toTeamStatus(getAttr(existingMember, "status"));
        if (existingStatus === SELLER_TEAM_API_STATUS.ACTIVE) {
          return buildTeamMutationError(
            res,
            409,
            "MEMBER_ALREADY_ACTIVE",
            "This user is already an active store member."
          );
        }

        if (existingStatus === SELLER_TEAM_PERSISTENCE_STATUS.INVITED) {
          return buildTeamMutationError(
            res,
            409,
            "MEMBER_ALREADY_INVITED",
            "This user already has a pending store invitation."
          );
        }

        if (existingStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
          return buildTeamMutationError(
            res,
            409,
            "MEMBER_REMOVED_RESTORE_REQUIRED",
            "This user was removed and needs a dedicated restore or re-invite flow."
          );
        }

        return buildTeamMutationError(
          res,
          409,
          "MEMBER_REACTIVATION_REQUIRED",
          "This member already exists and should be reactivated instead of attached again."
        );
      }

      const created = await StoreMember.create({
        storeId,
        userId: Number((user as any).id),
        storeRoleId: Number((targetRole as any).id),
        status: SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE,
        acceptedAt: new Date(),
        disabledAt: null,
        disabledByUserId: null,
        removedAt: null,
        removedByUserId: null,
      } as any);

      const member = await loadStoreMemberById(storeId, Number((created as any).id));
      const auditLog = await recordSellerTeamAudit({
        storeId,
        actorUserId: Number((req as any).user?.id || 0) || null,
        targetUserId: Number((user as any).id),
        targetMemberId: Number((member as any)?.id || 0) || null,
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH,
        beforeState: null,
        afterState: {
          roleCode,
          status: SELLER_TEAM_API_STATUS.ACTIVE,
        },
      });

      return res.status(201).json(
        serializeTeamMutationEnvelope({
          action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH,
          member,
          auditLogId: Number((auditLog as any)?.id || 0) || null,
          message: "Member attached to this store.",
        })
      );
    } catch (error: any) {
      if (String(error?.name || "") === "SequelizeUniqueConstraintError") {
        return buildTeamMutationError(
          res,
          409,
          "DUPLICATE_STORE_MEMBER",
          "A store membership for this user already exists."
        );
      }

      console.error("[seller/team:create-member] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to attach store member.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/members/:memberId/role",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE", "STORE_ROLES_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const memberId = Number(req.params.memberId);
      const sellerAccess = (req as any).sellerAccess;
      const parsed = updateMemberRoleSchema.safeParse(req.body);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return buildTeamMutationError(res, 400, "INVALID_MEMBER_ID", "Invalid member id.");
      }

      if (!parsed.success) {
        return buildTeamMutationError(
          res,
          400,
          "INVALID_MEMBER_PAYLOAD",
          "Invalid member payload."
        );
      }

      const roleCode = String(parsed.data.roleCode || "").trim().toUpperCase();
      const [member, targetRole] = await Promise.all([
        loadStoreMemberById(storeId, memberId),
        resolveStoreRoleByCode(roleCode),
      ]);

      if (!member) {
        return buildTeamMutationError(res, 404, "MEMBER_NOT_FOUND", "Store member not found.");
      }

      if (!targetRole) {
        return buildTeamMutationError(res, 400, "INVALID_STORE_ROLE", "Invalid seller role.");
      }

      const currentRoleCode = String(getAttr((member as any).role, "code") || "");
      const currentStatus = toTeamStatus(getAttr(member, "status"));
      const targetUserId = Number(getAttr(member, "userId")) || null;

      if (targetUserId !== null && targetUserId === getActorUserId(req)) {
        return buildTeamMutationError(
          res,
          403,
          "SELF_MUTATION_FORBIDDEN",
          "You cannot change your own store role."
        );
      }

      if (isOwnerUserTarget({ sellerAccess, targetUserId })) {
        return buildTeamMutationError(
          res,
          403,
          "OWNER_MUTATION_FORBIDDEN",
          "Store owner role cannot be changed in this phase."
        );
      }

      if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
        return buildTeamMutationError(
          res,
          409,
          "MEMBER_ROLE_CHANGE_REINVITE_REQUIRED",
          "Removed memberships can only change role while being reopened through re-invite."
        );
      }

      if (
        !canManageRole({
          actorRoleCode: sellerAccess.roleCode,
          targetRoleCode: currentRoleCode,
        }) ||
        !canAssignRole({
          actorRoleCode: sellerAccess.roleCode,
          nextRoleCode: roleCode,
        })
      ) {
        return buildTeamMutationError(
          res,
          403,
          "ROLE_CHANGE_FORBIDDEN",
          "You do not have permission to change this member role."
        );
      }

      if (currentRoleCode === roleCode) {
        return res.json(
          serializeTeamMutationEnvelope({
            action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
            member,
            auditLogId: null,
            message: "Member role already matches the requested seller role.",
          })
        );
      }

      await (member as any).update({
        storeRoleId: Number((targetRole as any).id),
      });

      const refreshed = await loadStoreMemberById(storeId, memberId);
      const auditLog = await recordSellerTeamAudit({
        storeId,
        actorUserId: Number((req as any).user?.id || 0) || null,
        targetUserId: Number(getAttr(refreshed, "userId")),
        targetMemberId: Number(getAttr(refreshed, "id")),
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
        beforeState: {
          roleCode: currentRoleCode,
          status: currentStatus,
        },
        afterState: {
          roleCode,
          status: toTeamStatus(getAttr(refreshed, "status")),
        },
      });

      return res.json(
        serializeTeamMutationEnvelope({
          action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
          member: refreshed,
          auditLogId: Number((auditLog as any)?.id || 0) || null,
          message: "Member role updated.",
        })
      );
    } catch (error) {
      console.error("[seller/team:update-role] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update store member role.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/members/:memberId/remove",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const memberId = Number(req.params.memberId);
      const sellerAccess = (req as any).sellerAccess;

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return buildTeamMutationError(res, 400, "INVALID_MEMBER_ID", "Invalid member id.");
      }

      const member = await loadStoreMemberById(storeId, memberId);
      if (!member) {
        return buildTeamMutationError(
          res,
          404,
          "SELLER_MEMBER_NOT_FOUND",
          "Store member not found."
        );
      }

      const currentRoleCode = String(getAttr((member as any).role, "code") || "");
      const currentStatus = String(getAttr(member, "status") || "").toUpperCase();
      const currentApiStatus = toTeamStatus(currentStatus);
      const actorUserId = getActorUserId(req);
      const targetUserId = Number(getAttr(member, "userId")) || null;

      if (targetUserId !== null && targetUserId === Number(actorUserId || -1)) {
        return buildTeamMutationError(
          res,
          403,
          "SELF_MUTATION_FORBIDDEN",
          "You cannot remove your own store membership."
        );
      }

      if (isOwnerUserTarget({ sellerAccess, targetUserId })) {
        return buildTeamMutationError(
          res,
          403,
          "OWNER_MUTATION_FORBIDDEN",
          "Store owner cannot be removed in this phase."
        );
      }

      if (sellerAccess.roleCode === "STORE_ADMIN" && currentRoleCode === "STORE_ADMIN") {
        return buildTeamMutationError(
          res,
          403,
          "PEER_ADMIN_MUTATION_FORBIDDEN",
          "Store admin cannot remove another store admin in this phase."
        );
      }

      if (
        !canManageRole({
          actorRoleCode: sellerAccess.roleCode,
          targetRoleCode: currentRoleCode,
        })
      ) {
        return buildTeamMutationError(
          res,
          403,
          "MEMBER_REMOVE_FORBIDDEN",
          "You do not have permission to remove this store member."
        );
      }

      if (currentStatus === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
        return buildTeamMutationError(
          res,
          409,
          "MEMBER_ALREADY_REMOVED",
          "This membership is already removed."
        );
      }

      if (
        currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE &&
        currentStatus !== SELLER_TEAM_PERSISTENCE_STATUS.DISABLED
      ) {
        return buildTeamMutationError(
          res,
          409,
          "INVALID_MEMBER_STATUS_TRANSITION",
          "Only active or disabled memberships can be removed operationally."
        );
      }

      const removedAt = new Date();
      await (member as any).update({
        status: SELLER_TEAM_PERSISTENCE_STATUS.REMOVED,
        removedAt,
        removedByUserId: actorUserId,
      });

      const refreshed = await loadStoreMemberById(storeId, memberId);
      const auditLog = await recordSellerTeamAudit({
        storeId,
        actorUserId,
        targetUserId: Number(getAttr(refreshed, "userId")),
        targetMemberId: Number(getAttr(refreshed, "id")),
        action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
        beforeState: {
          roleCode: currentRoleCode,
          status: currentApiStatus,
        },
        afterState: {
          roleCode: currentRoleCode,
          status: SELLER_TEAM_PERSISTENCE_STATUS.REMOVED,
        },
      });

      return res.json(
        serializeTeamMutationEnvelope({
          action: SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
          member: refreshed,
          auditLogId: Number((auditLog as any)?.id || 0) || null,
          message: "Member removed from this store.",
        })
      );
    } catch (error) {
      console.error("[seller/team:remove] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to remove store member.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/members/:memberId/status",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const memberId = Number(req.params.memberId);
      const sellerAccess = (req as any).sellerAccess;
      const parsed = updateMemberStatusSchema.safeParse(req.body);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return buildTeamMutationError(res, 400, "INVALID_MEMBER_ID", "Invalid member id.");
      }

      if (!parsed.success) {
        return buildTeamMutationError(
          res,
          400,
          "INVALID_MEMBER_PAYLOAD",
          "Invalid member payload."
        );
      }

      const member = await loadStoreMemberById(storeId, memberId);
      if (!member) {
        return buildTeamMutationError(res, 404, "MEMBER_NOT_FOUND", "Store member not found.");
      }

      const currentRoleCode = String(getAttr((member as any).role, "code") || "");
      const targetUserId = Number(getAttr(member, "userId")) || null;

      if (targetUserId !== null && targetUserId === getActorUserId(req)) {
        return buildTeamMutationError(
          res,
          403,
          "SELF_MUTATION_FORBIDDEN",
          "You cannot change your own membership status."
        );
      }

      if (isOwnerUserTarget({ sellerAccess, targetUserId })) {
        return buildTeamMutationError(
          res,
          403,
          "OWNER_MUTATION_FORBIDDEN",
          "Store owner status cannot be changed in this phase."
        );
      }

      if (
        !canManageRole({
          actorRoleCode: sellerAccess.roleCode,
          targetRoleCode: currentRoleCode,
        })
      ) {
        return buildTeamMutationError(
          res,
          403,
          "STATUS_CHANGE_FORBIDDEN",
          "You do not have permission to change this member status."
        );
      }

      const requestedStatus = parsed.data.status;
      const nextDbStatus = toMemberDbStatus(requestedStatus);
      const currentApiStatus = toTeamStatus(getAttr(member, "status"));

      if (!isPhase1OperationalStatus(getAttr(member, "status"))) {
        return buildTeamMutationError(
          res,
          409,
          "INVALID_MEMBER_STATUS_TRANSITION",
          "This membership status is not handled by phase 1 status mutations."
        );
      }

      if (currentApiStatus === requestedStatus) {
        return res.json(
          serializeTeamMutationEnvelope({
            action:
              requestedStatus === SELLER_TEAM_API_STATUS.ACTIVE
                ? SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE
                : SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE,
            member,
            auditLogId: null,
            message:
              requestedStatus === SELLER_TEAM_API_STATUS.ACTIVE
                ? "Member is already active."
                : "Member is already disabled.",
          })
        );
      }

      await (member as any).update({
        status: nextDbStatus,
        acceptedAt:
          requestedStatus === SELLER_TEAM_API_STATUS.ACTIVE
            ? (getAttr(member, "acceptedAt") || new Date())
            : getAttr(member, "acceptedAt") || null,
        disabledAt:
          requestedStatus === SELLER_TEAM_API_STATUS.DISABLED ? new Date() : null,
        disabledByUserId:
          requestedStatus === SELLER_TEAM_API_STATUS.DISABLED
            ? Number((req as any).user?.id || 0) || null
            : null,
        removedAt: null,
        removedByUserId: null,
      });

      const refreshed = await loadStoreMemberById(storeId, memberId);
      const action =
        requestedStatus === SELLER_TEAM_API_STATUS.ACTIVE
          ? SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE
          : SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE;
      const auditLog = await recordSellerTeamAudit({
        storeId,
        actorUserId: Number((req as any).user?.id || 0) || null,
        targetUserId: Number(getAttr(refreshed, "userId")),
        targetMemberId: Number(getAttr(refreshed, "id")),
        action,
        beforeState: {
          roleCode: currentRoleCode,
          status: currentApiStatus,
        },
        afterState: {
          roleCode: currentRoleCode,
          status: toTeamStatus(getAttr(refreshed, "status")),
        },
      });

      return res.json(
        serializeTeamMutationEnvelope({
          action,
          member: refreshed,
          auditLogId: Number((auditLog as any)?.id || 0) || null,
          message:
            requestedStatus === SELLER_TEAM_API_STATUS.ACTIVE
              ? "Member reactivated."
              : "Member disabled.",
        })
      );
    } catch (error) {
      console.error("[seller/team:update-status] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update store member status.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/members/:memberId/lifecycle",
  requireSellerStoreAccess(["STORE_MEMBERS_MANAGE"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const memberId = Number(req.params.memberId);

      if (!Number.isInteger(memberId) || memberId <= 0) {
        return buildTeamMutationError(res, 400, "INVALID_MEMBER_ID", "Invalid member id.");
      }

      const member = await loadStoreMemberById(storeId, memberId);
      if (!member) {
        return buildTeamMutationError(res, 404, "MEMBER_NOT_FOUND", "Store member not found.");
      }

      const historyItems = await StoreAuditLog.findAll({
        where: {
          storeId,
          targetMemberId: memberId,
          action: {
            [Op.in]: [
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REINVITE,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_ACCEPT,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ATTACH,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_ROLE_CHANGE,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_DISABLE,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REACTIVATE,
              SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
            ],
          },
        } as any,
        attributes: [
          "id",
          "storeId",
          "actorUserId",
          "targetUserId",
          "targetMemberId",
          "action",
          "beforeState",
          "afterState",
          "createdAt",
        ],
        include: [
          {
            model: User,
            as: "actorUser",
            attributes: ["id", "name", "email"],
            required: false,
          },
          {
            model: User,
            as: "targetUser",
            attributes: ["id", "name", "email"],
            required: false,
          },
          {
            model: StoreMember,
            as: "targetMember",
            attributes: ["id", "userId", "storeRoleId", "status"],
            required: false,
            include: [
              {
                model: StoreRole,
                as: "role",
                attributes: ["id", "code", "name"],
                required: false,
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        limit: 20,
      });

      const removedHistoryMatch = historyItems.find((item) =>
        [
          SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_INVITE_DECLINE,
          SELLER_TEAM_AUDIT_ACTIONS.TEAM_MEMBER_REMOVE,
        ].includes(String(getAttr(item, "action") || "") as any)
      );
      const removedAction = removedHistoryMatch ? String(getAttr(removedHistoryMatch, "action") || "") : null;
      const removedSource = getRemovedSourceFromAction(removedAction);

      return res.json({
        success: true,
        data: {
          member: serializeStoreMember(member),
          statusContract: SELLER_TEAM_STATUS_CONTRACT,
          lifecycle: {
            invitedAt: getAttr(member, "invitedAt") || null,
            acceptedAt: getAttr(member, "acceptedAt") || null,
            disabledAt: getAttr(member, "disabledAt") || null,
            removedAt: getAttr(member, "removedAt") || null,
            removedSource,
            removedSourceLabel: getRemovedSourceLabel(removedSource),
            lastRemovalAction: removedAction,
          },
          history: {
            total: historyItems.length,
            items: historyItems.map(serializeTeamAuditRow),
          },
        },
      });
    } catch (error) {
      console.error("[seller/team:lifecycle] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller member lifecycle.",
      });
    }
  }
);

export default router;
