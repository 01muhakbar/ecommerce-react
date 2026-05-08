import { Transaction } from "sequelize";
import {
  sequelize,
  Store,
  StoreApplication,
  StoreMember,
  StoreRole,
} from "../models/index.js";
import {
  buildStoreApplicationMutationMetadata,
  normalizeStoreApplicationSnapshots,
} from "./storeApplication.js";
import { SELLER_ROLE_CODES } from "./seller/permissionMap.js";
import { ensureSystemStoreRoles } from "./seller/storeRoles.js";

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key] ?? row?.[key];

const toText = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const normalizeStoreSlug = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveTypedSocialUrl = (value: unknown, platform: "instagram" | "tiktok") => {
  const normalized = toText(value);
  if (!normalized) return null;
  const lowered = normalized.toLowerCase();
  if (platform === "instagram" && lowered.includes("instagram")) return normalized;
  if (platform === "tiktok" && lowered.includes("tiktok")) return normalized;
  return null;
};

const buildStoreSlugBase = (application: any) => {
  const snapshots = normalizeStoreApplicationSnapshots(application);

  return (
    normalizeStoreSlug(snapshots.storeInformationSnapshot.storeSlug) ||
    normalizeStoreSlug(snapshots.storeInformationSnapshot.storeName) ||
    normalizeStoreSlug(snapshots.ownerIdentitySnapshot.fullName) ||
    `store-${Number(getAttr(application, "applicantUserId") || 0) || "applicant"}`
  );
};

const loadOwnerStoreRole = async (transaction?: Transaction) =>
  StoreRole.findOne({
    where: {
      code: SELLER_ROLE_CODES.STORE_OWNER,
      isActive: true,
    } as any,
    transaction,
  });

const findAvailableStoreSlug = async (
  application: any,
  transaction?: Transaction
): Promise<string> => {
  const applicationId = Number(getAttr(application, "id") || 0) || Date.now();
  const base = buildStoreSlugBase(application) || `store-${applicationId}`;
  const candidates = [base, `${base}-${applicationId}`];

  for (const candidate of candidates) {
    const existing = await Store.findOne({
      where: { slug: candidate } as any,
      attributes: ["id"],
      transaction,
    });
    if (!existing) return candidate;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${base}-${applicationId}-${suffix}`;
    const existing = await Store.findOne({
      where: { slug: candidate } as any,
      attributes: ["id"],
      transaction,
    });
    if (!existing) return candidate;
    suffix += 1;
  }

  return `${base}-${Date.now()}`;
};

const buildStoreCreatePayload = (application: any, slug: string) => {
  const snapshots = normalizeStoreApplicationSnapshots(application);

  return {
    ownerUserId: Number(getAttr(application, "applicantUserId") || 0),
    name:
      toText(snapshots.storeInformationSnapshot.storeName) ||
      toText(snapshots.ownerIdentitySnapshot.fullName) ||
      `Store ${Number(getAttr(application, "applicantUserId") || 0)}`,
    slug,
    status: "INACTIVE",
    description: toText(snapshots.storeInformationSnapshot.description),
    email:
      toText(snapshots.complianceSnapshot.supportEmail) ||
      toText(snapshots.ownerIdentitySnapshot.email),
    phone:
      toText(snapshots.operationalAddressSnapshot.phoneNumber) ||
      toText(snapshots.ownerIdentitySnapshot.phoneNumber),
    whatsapp:
      toText(snapshots.operationalAddressSnapshot.phoneNumber) ||
      toText(snapshots.ownerIdentitySnapshot.phoneNumber),
    websiteUrl: toText(snapshots.complianceSnapshot.websiteUrl),
    instagramUrl: resolveTypedSocialUrl(
      snapshots.complianceSnapshot.socialMediaUrl,
      "instagram"
    ),
    tiktokUrl: resolveTypedSocialUrl(
      snapshots.complianceSnapshot.socialMediaUrl,
      "tiktok"
    ),
    addressLine1: toText(snapshots.operationalAddressSnapshot.addressLine1),
    addressLine2: toText(snapshots.operationalAddressSnapshot.addressLine2),
    city: toText(snapshots.operationalAddressSnapshot.city),
    province: toText(snapshots.operationalAddressSnapshot.province),
    postalCode: toText(snapshots.operationalAddressSnapshot.postalCode),
    country: toText(snapshots.operationalAddressSnapshot.country),
  };
};

const ensureOwnerMembership = async (input: {
  storeId: number;
  ownerUserId: number;
  transaction?: Transaction;
}) => {
  const ownerRole = await loadOwnerStoreRole(input.transaction);
  if (!ownerRole) {
    throw new Error("STORE_OWNER role is missing.");
  }

  const existing = await StoreMember.findOne({
    where: {
      storeId: input.storeId,
      userId: input.ownerUserId,
    } as any,
    transaction: input.transaction,
  });

  if (!existing) {
    return StoreMember.create(
      {
        storeId: input.storeId,
        userId: input.ownerUserId,
        storeRoleId: Number(getAttr(ownerRole, "id") || 0),
        status: "ACTIVE",
        acceptedAt: new Date(),
        disabledAt: null,
        disabledByUserId: null,
        removedAt: null,
        removedByUserId: null,
      } as any,
      { transaction: input.transaction }
    );
  }

  const patch: Record<string, unknown> = {};
  if (String(getAttr(existing, "status") || "").toUpperCase() !== "ACTIVE") {
    patch.status = "ACTIVE";
    patch.acceptedAt = getAttr(existing, "acceptedAt") || new Date();
    patch.disabledAt = null;
    patch.disabledByUserId = null;
    patch.removedAt = null;
    patch.removedByUserId = null;
  }
  if (Number(getAttr(existing, "storeRoleId") || 0) !== Number(getAttr(ownerRole, "id") || 0)) {
    patch.storeRoleId = Number(getAttr(ownerRole, "id") || 0);
  }
  if (!getAttr(existing, "acceptedAt")) {
    patch.acceptedAt = getAttr(existing, "createdAt") || new Date();
  }

  if (Object.keys(patch).length > 0) {
    await existing.update(patch, { transaction: input.transaction });
    await existing.reload({ transaction: input.transaction });
  }

  return existing;
};

export async function provisionApprovedStoreApplication(application: any) {
  await ensureSystemStoreRoles();

  return sequelize.transaction(async (transaction) => {
    const applicationId = Number(getAttr(application, "id") || 0);
    const applicantUserId = Number(getAttr(application, "applicantUserId") || 0);
    if (!(applicationId > 0) || !(applicantUserId > 0)) {
      throw new Error("Invalid store application for provisioning.");
    }

    const lockedApplication = await StoreApplication.findByPk(applicationId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!lockedApplication) {
      throw new Error("Store application not found during provisioning.");
    }

    const currentMetadata = getAttr(lockedApplication, "internalMetadata");
    const currentActivation =
      currentMetadata &&
      typeof currentMetadata === "object" &&
      !Array.isArray(currentMetadata) &&
      (currentMetadata as Record<string, any>).activation &&
      typeof (currentMetadata as Record<string, any>).activation === "object"
        ? ((currentMetadata as Record<string, any>).activation as Record<string, any>)
        : {};

    let store = await Store.findOne({
      where: { ownerUserId: applicantUserId } as any,
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let provisionedMode: "created_store" | "reused_store" = "reused_store";
    if (!store) {
      const slug = await findAvailableStoreSlug(lockedApplication, transaction);
      store = await Store.create(buildStoreCreatePayload(lockedApplication, slug) as any, {
        transaction,
      });
      provisionedMode = "created_store";
    }

    const membership = await ensureOwnerMembership({
      storeId: Number(getAttr(store, "id") || 0),
      ownerUserId: applicantUserId,
      transaction,
    });

    const nextMetadata: any = buildStoreApplicationMutationMetadata(currentMetadata, {
      activation: {
        ...currentActivation,
        storeId: Number(getAttr(store, "id") || 0),
        storeSlug: toText(getAttr(store, "slug")),
        storeStatus: toText(getAttr(store, "status")) || "INACTIVE",
        ownerMembershipId: Number(getAttr(membership, "id") || 0) || null,
        ownerMembershipStatus: toText(getAttr(membership, "status")) || "ACTIVE",
        sellerAccessReady: true,
        provisionedAt: new Date().toISOString(),
        provisionedMode,
        source: "store_application_approval",
      },
    });

    await lockedApplication.update(
      {
        internalMetadata: nextMetadata,
      } as any,
      { transaction }
    );

    return {
      store,
      membership,
      activation: nextMetadata.activation,
    };
  });
}
