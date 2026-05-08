import { Op } from "sequelize";
import { StoreAuditLog, User } from "../models/index.js";

const PRODUCT_ACTIVITY_ACTIONS = {
  CREATED: "PRODUCT_CREATED",
  UPDATED: "PRODUCT_UPDATED",
  DUPLICATED: "PRODUCT_DUPLICATED",
  DELETED: "PRODUCT_DELETED",
  ARCHIVED: "PRODUCT_ARCHIVED",
  IMPORTED: "PRODUCT_IMPORTED",
  SUBMITTED_FOR_REVIEW: "PRODUCT_SUBMITTED_FOR_REVIEW",
  REVIEW_APPROVED: "PRODUCT_REVIEW_APPROVED",
  REVIEW_REJECTED: "PRODUCT_REVIEW_REJECTED",
  PUBLISHED: "PRODUCT_PUBLISHED",
  UNPUBLISHED: "PRODUCT_UNPUBLISHED",
} as const;

type ProductActivityAction =
  (typeof PRODUCT_ACTIVITY_ACTIONS)[keyof typeof PRODUCT_ACTIVITY_ACTIONS];

const PRODUCT_ACTIVITY_ACTION_SET = new Set<string>(Object.values(PRODUCT_ACTIVITY_ACTIONS));

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const serializeJson = (value: Record<string, unknown> | null) => {
  if (!value) return null;
  return JSON.stringify(value);
};

const parseJson = (value: unknown) => {
  if (!value || typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const normalizeProductSnapshot = (product: any = null) => {
  if (!product || typeof product !== "object") return null;

  const id = asNumber(getAttr(product, "id") ?? product.id, 0);
  const storeId = asNumber(getAttr(product, "storeId") ?? product.storeId, 0);
  const name = normalizeText(getAttr(product, "name") ?? product.name);
  const slug = normalizeText(getAttr(product, "slug") ?? product.slug);
  const sku = normalizeText(getAttr(product, "sku") ?? product.sku) || null;
  const status = normalizeText(getAttr(product, "status") ?? product.status).toLowerCase() || null;
  const submissionStatus =
    normalizeText(
      getAttr(product, "sellerSubmissionStatus") ?? product.sellerSubmissionStatus
    ).toLowerCase() || "none";
  const publishedRaw =
    getAttr(product, "isPublished") ??
    getAttr(product, "published") ??
    product.isPublished ??
    product.published;
  const published =
    typeof publishedRaw === "boolean"
      ? publishedRaw
      : publishedRaw === null || typeof publishedRaw === "undefined"
        ? null
        : Boolean(publishedRaw);

  if (!id) return null;

  return {
    entityType: "product",
    entityId: id,
    storeId: storeId || null,
    name: name || null,
    slug: slug || null,
    sku,
    status,
    submissionStatus,
    published,
  };
};

const buildMetadata = (input: {
  beforeSnapshot?: any;
  afterSnapshot?: any;
  metadata?: Record<string, unknown> | null;
}) => {
  const beforeSnapshot = input.beforeSnapshot || null;
  const afterSnapshot = input.afterSnapshot || null;

  return {
    productName: afterSnapshot?.name || beforeSnapshot?.name || null,
    sku: afterSnapshot?.sku || beforeSnapshot?.sku || null,
    previousStatus: beforeSnapshot?.status || null,
    newStatus: afterSnapshot?.status || null,
    previousSubmissionStatus: beforeSnapshot?.submissionStatus || null,
    newSubmissionStatus: afterSnapshot?.submissionStatus || null,
    previousPublished:
      typeof beforeSnapshot?.published === "boolean" ? beforeSnapshot.published : null,
    newPublished:
      typeof afterSnapshot?.published === "boolean" ? afterSnapshot.published : null,
    ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
  };
};

export async function logProductActivity(input: {
  storeId: number;
  entityId: number;
  action: ProductActivityAction;
  actorType: "admin" | "seller" | "system";
  actorId?: number | null;
  before?: any;
  after?: any;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    if (!PRODUCT_ACTIVITY_ACTION_SET.has(String(input.action || "").trim())) {
      return null;
    }

    const beforeSnapshot = normalizeProductSnapshot(input.before);
    const afterSnapshot = normalizeProductSnapshot(input.after);
    const metadata = buildMetadata({
      beforeSnapshot,
      afterSnapshot,
      metadata: input.metadata,
    });

    return await StoreAuditLog.create({
      storeId: asNumber(input.storeId, 0),
      actorUserId: asNumber(input.actorId, 0) || null,
      action: input.action,
      beforeState: serializeJson(
        beforeSnapshot
          ? {
              entityType: "product",
              entityId: beforeSnapshot.entityId,
              snapshot: beforeSnapshot,
            }
          : null
      ),
      afterState: serializeJson({
        entityType: "product",
        entityId:
          afterSnapshot?.entityId || beforeSnapshot?.entityId || asNumber(input.entityId, 0),
        actorType: input.actorType,
        snapshot: afterSnapshot,
        metadata,
      }),
    } as any);
  } catch (error) {
    console.error("[product-activity-log] failed", error);
    return null;
  }
}

export const PRODUCT_ACTIVITY_LOG_ACTIONS = PRODUCT_ACTIVITY_ACTIONS;

export async function listProductActivity(input: {
  storeId?: number | null;
  productId: number;
  limit?: number;
  offset?: number;
}) {
  const productId = asNumber(input.productId, 0);
  const limit = Math.max(1, Math.min(100, asNumber(input.limit, 20)));
  const offset = Math.max(0, asNumber(input.offset, 0));
  const storeId = asNumber(input.storeId, 0) || null;

  const rows = await StoreAuditLog.findAll({
    where: {
      ...(storeId ? { storeId } : {}),
      action: {
        [Op.in]: [...PRODUCT_ACTIVITY_ACTION_SET],
      },
    } as any,
    include: [
      {
        model: User,
        as: "actorUser",
        attributes: ["id", "name", "email", "role"],
        required: false,
      },
    ],
    order: [["createdAt", "DESC"]],
  });

  const filtered = rows
    .map((row: any) => {
      const beforeState = parseJson(getAttr(row, "beforeState"));
      const afterState = parseJson(getAttr(row, "afterState"));
      const entityId = asNumber(
        afterState?.entityId ??
          afterState?.snapshot?.entityId ??
          beforeState?.entityId ??
          beforeState?.snapshot?.entityId,
        0
      );
      if (entityId !== productId) return null;

      const actorUser =
        row?.actorUser ?? row?.get?.("actorUser") ?? row?.dataValues?.actorUser ?? null;
      const actorName =
        normalizeText(actorUser?.name) ||
        normalizeText(actorUser?.email) ||
        (afterState?.actorType === "system" ? "System" : "Unknown actor");

      return {
        id: asNumber(getAttr(row, "id"), 0),
        action: normalizeText(getAttr(row, "action")),
        actorType: normalizeText(afterState?.actorType) || "system",
        actorName,
        createdAt: getAttr(row, "createdAt") || null,
        metadata:
          afterState?.metadata && typeof afterState.metadata === "object"
            ? afterState.metadata
            : {},
      };
    })
    .filter(Boolean);

  return {
    total: filtered.length,
    items: filtered.slice(offset, offset + limit),
  };
}
