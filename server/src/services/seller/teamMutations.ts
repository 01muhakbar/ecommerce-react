import { SELLER_ROLE_CODES } from "./permissionMap.js";
import { StoreMember, StoreRole, User } from "../../models/index.js";

export const SELLER_TEAM_API_STATUS = {
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
} as const;

export const SELLER_TEAM_PERSISTENCE_STATUS = {
  INVITED: "INVITED",
  ACTIVE: "ACTIVE",
  DISABLED: "DISABLED",
  REMOVED: "REMOVED",
} as const;

export const SELLER_TEAM_LEGACY_PERSISTENCE_STATUS = {
  INACTIVE: "INACTIVE",
} as const;

export const SELLER_TEAM_STATUS_CONTRACT = {
  active: SELLER_TEAM_API_STATUS.ACTIVE,
  disabled: SELLER_TEAM_API_STATUS.DISABLED,
  persistenceDisabled: SELLER_TEAM_PERSISTENCE_STATUS.DISABLED,
  lifecycleStatuses: [
    SELLER_TEAM_PERSISTENCE_STATUS.INVITED,
    SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE,
    SELLER_TEAM_PERSISTENCE_STATUS.DISABLED,
    SELLER_TEAM_PERSISTENCE_STATUS.REMOVED,
  ],
  legacyPersistenceDisabled: SELLER_TEAM_LEGACY_PERSISTENCE_STATUS.INACTIVE,
} as const;

const OPERATIONAL_ROLE_CODES = new Set([
  SELLER_ROLE_CODES.CATALOG_MANAGER,
  SELLER_ROLE_CODES.MARKETING_MANAGER,
  SELLER_ROLE_CODES.ORDER_MANAGER,
  SELLER_ROLE_CODES.FINANCE_VIEWER,
  SELLER_ROLE_CODES.CONTENT_MANAGER,
]);

const MANAGEABLE_BY_OWNER = new Set([
  SELLER_ROLE_CODES.STORE_ADMIN,
  ...OPERATIONAL_ROLE_CODES,
]);

const MANAGEABLE_BY_ADMIN = OPERATIONAL_ROLE_CODES;

export function getAttr(row: any, key: string) {
  return row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];
}

export function toTeamStatus(value: unknown) {
  const normalized = String(value || "").toUpperCase();
  if (normalized === SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE) {
    return SELLER_TEAM_API_STATUS.ACTIVE;
  }
  if (
    normalized === SELLER_TEAM_PERSISTENCE_STATUS.DISABLED ||
    normalized === SELLER_TEAM_LEGACY_PERSISTENCE_STATUS.INACTIVE
  ) {
    return SELLER_TEAM_API_STATUS.DISABLED;
  }
  if (normalized === SELLER_TEAM_PERSISTENCE_STATUS.INVITED) {
    return SELLER_TEAM_PERSISTENCE_STATUS.INVITED;
  }
  if (normalized === SELLER_TEAM_PERSISTENCE_STATUS.REMOVED) {
    return SELLER_TEAM_PERSISTENCE_STATUS.REMOVED;
  }
  return SELLER_TEAM_API_STATUS.DISABLED;
}

export function toMemberDbStatus(value: string) {
  return value === SELLER_TEAM_API_STATUS.ACTIVE
    ? SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE
    : SELLER_TEAM_PERSISTENCE_STATUS.DISABLED;
}

export function isActiveStoreMemberStatus(value: unknown) {
  return String(value || "").toUpperCase() === SELLER_TEAM_PERSISTENCE_STATUS.ACTIVE;
}

export function isPhase1OperationalStatus(value: unknown) {
  const normalized = toTeamStatus(value);
  return (
    normalized === SELLER_TEAM_API_STATUS.ACTIVE ||
    normalized === SELLER_TEAM_API_STATUS.DISABLED
  );
}

export function isOwnerRole(roleCode: string | null | undefined) {
  return String(roleCode || "") === SELLER_ROLE_CODES.STORE_OWNER;
}

export function isAdminRole(roleCode: string | null | undefined) {
  return String(roleCode || "") === SELLER_ROLE_CODES.STORE_ADMIN;
}

export function canManageRole(args: {
  actorRoleCode: string;
  targetRoleCode: string | null | undefined;
}) {
  const actorRoleCode = String(args.actorRoleCode || "");
  const targetRoleCode = String(args.targetRoleCode || "");

  if (isOwnerRole(targetRoleCode)) return false;
  if (isOwnerRole(actorRoleCode)) return MANAGEABLE_BY_OWNER.has(targetRoleCode as any);
  if (isAdminRole(actorRoleCode)) return MANAGEABLE_BY_ADMIN.has(targetRoleCode as any);
  return false;
}

export function canAssignRole(args: {
  actorRoleCode: string;
  nextRoleCode: string | null | undefined;
}) {
  const actorRoleCode = String(args.actorRoleCode || "");
  const nextRoleCode = String(args.nextRoleCode || "");

  if (isOwnerRole(nextRoleCode)) return false;
  if (isOwnerRole(actorRoleCode)) return MANAGEABLE_BY_OWNER.has(nextRoleCode as any);
  if (isAdminRole(actorRoleCode)) return MANAGEABLE_BY_ADMIN.has(nextRoleCode as any);
  return false;
}

export async function resolveStoreRoleByCode(roleCode: string) {
  return StoreRole.findOne({
    where: { code: roleCode, isActive: true } as any,
    attributes: ["id", "code", "name", "description", "isActive", "isSystem"],
  });
}

export async function findUserByEmail(email: string) {
  return User.findOne({
    where: { email } as any,
    attributes: ["id", "name", "email", "status", "role"],
  });
}

export async function loadStoreMemberById(storeId: number, memberId: number) {
  return StoreMember.findOne({
    where: { id: memberId, storeId } as any,
    attributes: [
      "id",
      "storeId",
      "userId",
      "storeRoleId",
      "status",
      "invitedAt",
      "acceptedAt",
      "disabledAt",
      "removedAt",
      "createdAt",
      "updatedAt",
    ],
    include: [
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
}

export async function loadStoreMemberByUserId(storeId: number, userId: number) {
  return StoreMember.findOne({
    where: { storeId, userId } as any,
    attributes: [
      "id",
      "storeId",
      "userId",
      "storeRoleId",
      "status",
      "invitedAt",
      "acceptedAt",
      "disabledAt",
      "removedAt",
      "createdAt",
      "updatedAt",
    ],
    include: [
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
}

export async function listStoreMembersForTeam(storeId: number) {
  return StoreMember.findAll({
    where: { storeId } as any,
    attributes: [
      "id",
      "storeId",
      "userId",
      "storeRoleId",
      "status",
      "invitedAt",
      "acceptedAt",
      "disabledAt",
      "removedAt",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "name", "email"],
        required: false,
      },
      {
        model: StoreRole,
        as: "role",
        attributes: ["id", "code", "name", "description", "isActive"],
        required: false,
      },
    ],
    order: [["createdAt", "ASC"]],
  });
}

export function serializeStoreMember(member: any) {
  const user = member?.user ?? member?.get?.("user") ?? null;
  const role = member?.role ?? member?.get?.("role") ?? null;

  return {
    id: Number(getAttr(member, "id")),
    userId: Number(getAttr(member, "userId")),
    name: user ? String(getAttr(user, "name") || "") : "",
    email: user ? String(getAttr(user, "email") || "") : "",
    roleCode: role ? String(getAttr(role, "code") || "") : "",
    roleName: role ? String(getAttr(role, "name") || "") : "",
    status: toTeamStatus(getAttr(member, "status")),
    invitedAt: getAttr(member, "invitedAt") || null,
    acceptedAt: getAttr(member, "acceptedAt") || null,
    disabledAt: getAttr(member, "disabledAt") || null,
    removedAt: getAttr(member, "removedAt") || null,
    joinedAt: getAttr(member, "createdAt") || null,
    updatedAt: getAttr(member, "updatedAt") || null,
  };
}

export function serializeTeamMutationEnvelope(args: {
  action: string;
  member: any;
  auditLogId?: number | null;
  message: string;
}) {
  return {
    success: true,
    message: args.message,
    data: {
      action: args.action,
      member: serializeStoreMember(args.member),
      auditLogId: args.auditLogId ?? null,
      statusContract: SELLER_TEAM_STATUS_CONTRACT,
    },
  };
}

export function buildTeamMutationError(res: any, status: number, code: string, message: string) {
  return res.status(status).json({
    success: false,
    code,
    message,
  });
}
