import { Op, type Order } from "sequelize";
import { Router } from "express";
import multer from "multer";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import {
  CartItem,
  Category,
  OrderItem,
  Product,
  ProductCategory,
  ProductReview,
  Store,
  SuborderItem,
  sequelize,
} from "../models/index.js";
import {
  buildProductVisibilitySnapshot,
  isStorefrontStoreActive,
} from "../services/productVisibility.js";
import { sellerHasPermission } from "../services/seller/resolveSellerAccess.js";
import { buildPublicStoreOperationalReadiness } from "../services/sharedContracts/publicStoreIdentity.js";
import { STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES } from "../services/sharedContracts/storePaymentProfileCompat.js";
import {
  logProductActivity,
  PRODUCT_ACTIVITY_LOG_ACTIONS,
} from "../services/productActivityLog.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const getAttr = (row: any, key: string) =>
  row?.getDataValue?.(key) ?? row?.get?.(key) ?? row?.dataValues?.[key];

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePositiveInt = (
  raw: unknown,
  fallback: number,
  min: number,
  max: number
) => {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
};

const normalizeString = (value: unknown) => String(value || "").trim();

const nullableString = (value: unknown) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const parseOptionalPositiveId = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeCategoryIdsInput = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;
  return Array.from(
    new Set(
      value
        .map((entry) => parseOptionalPositiveId(entry))
        .filter((entry) => entry !== null)
    )
  ) as number[];
};

const normalizeOptionalMoney = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const normalizeOptionalInteger = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : Number.NaN;
};

const normalizeStoredImagePathList = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.map((entry: unknown) => normalizeString(entry)).filter(Boolean);
  }

  const normalized = normalizeString(value);
  if (!normalized) return [];

  try {
    const parsed = JSON.parse(normalized);
    if (Array.isArray(parsed)) {
      return parsed.map((entry: unknown) => normalizeString(entry)).filter(Boolean);
    }
  } catch {
    // Fall through to a single-string path payload.
  }

  return [normalized];
};

const normalizeTagListInput = (value: unknown) => {
  if (typeof value === "undefined") return undefined;

  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [value];

  return Array.from(
    new Set(entries.map((entry) => normalizeString(entry)).filter(Boolean))
  ).slice(0, 24);
};

const normalizeProductImageUrl = (value: unknown) => {
  const normalized = normalizeString(value);
  if (!normalized) return null;
  if (/^https?:\/\//i.test(normalized)) return normalized;
  if (normalized.startsWith("/uploads/")) return normalized;
  if (normalized.startsWith("uploads/")) return `/${normalized}`;
  return null;
};

const parseBooleanFilter = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes"].includes(normalized)) return true;
  if (["0", "false", "no"].includes(normalized)) return false;
  return null;
};

const allowedStatuses = new Set(["active", "inactive", "draft"]);
const allowedSellerSubmissionStatuses = new Set(["none", "submitted", "needs_revision"]);
const allowedSellerSubmissionFilters = new Set([
  "none",
  "submitted",
  "needs_revision",
  "review_queue",
  "ready_to_submit",
]);
const allowedVisibilityStates = new Set([
  "internal_only",
  "storefront_visible",
  "published_blocked",
]);
const allowedSellerBulkActions = new Set(["submit_review", "resubmit_review"]);
const allowedSellerSorts = new Set([
  "price_asc",
  "price_desc",
  "date_added",
  "date_updated",
]);

const normalizeProductStatus = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return allowedStatuses.has(normalized) ? normalized : "draft";
};

const normalizeSellerSubmissionStatus = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return allowedSellerSubmissionStatuses.has(normalized) ? normalized : "none";
};

const normalizeSellerSubmissionFilter = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return allowedSellerSubmissionFilters.has(normalized) ? normalized : "";
};

const normalizeVisibilityStateFilter = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return allowedVisibilityStates.has(normalized) ? normalized : "";
};

const normalizeSellerBulkAction = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return allowedSellerBulkActions.has(normalized) ? normalized : "";
};

const normalizePositiveIdList = (value: unknown, max = 200) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((entry) => parseOptionalPositiveId(entry))
        .filter((entry) => entry !== null)
    )
  ).slice(0, max) as number[];
};

const normalizePositiveIdFilterList = (value: unknown, max = 200) => {
  const entries = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : typeof value === "number"
        ? [value]
        : [];

  return Array.from(
    new Set(
      entries
        .map((entry) => parseOptionalPositiveId(entry))
        .filter((entry) => entry !== null)
    )
  ).slice(0, max) as number[];
};

const normalizeSellerSort = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return allowedSellerSorts.has(normalized) ? normalized : "";
};

const normalizeSellerExportFormat = (value: unknown) => {
  const normalized = normalizeString(value).toLowerCase();
  return normalized === "json" ? "json" : "csv";
};

const buildProductSlugBase = (value: unknown) => {
  const normalized =
    normalizeString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product";
  return normalized.slice(0, 180);
};

const DUPLICATE_VARIATION_STRIP_KEYS = new Set([
  "productId",
  "product_id",
  "variantId",
  "variant_id",
  "createdAt",
  "created_at",
  "updatedAt",
  "updated_at",
]);

const sanitizeDuplicateStructuredValue = (value: unknown): any => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeDuplicateStructuredValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce(
      (acc, [key, entryValue]) => {
        if (DUPLICATE_VARIATION_STRIP_KEYS.has(key)) return acc;
        acc[key] = sanitizeDuplicateStructuredValue(entryValue);
        return acc;
      },
      {} as Record<string, unknown>
    );
  }

  return value;
};

const normalizeDuplicateName = (value: unknown) => {
  const name = normalizeString(value) || "Product";
  return `${name} (Copy)`.slice(0, 255);
};

const resolveUniqueDuplicateSku = async (
  value: unknown,
  excludeProductId?: number | null
) => {
  const sourceSku = normalizeString(value);
  if (!sourceSku) return null;

  for (let index = 0; index < 200; index += 1) {
    const suffix = index === 0 ? "-COPY" : `-COPY-${index + 1}`;
    const trimmedBase = sourceSku.slice(0, Math.max(0, 100 - suffix.length));
    const candidate = `${trimmedBase}${suffix}`;
    const existing = await Product.findOne({
      where: {
        sku: candidate,
        ...(excludeProductId && excludeProductId > 0
          ? { id: { [Op.ne]: excludeProductId } }
          : {}),
      } as any,
      attributes: ["id"],
    });

    if (!existing) return candidate;
  }

  return null;
};

const resolveUniqueProductSlug = async (name: unknown, excludeProductId?: number | null) => {
  const baseSlug = buildProductSlugBase(name);

  for (let index = 0; index < 200; index += 1) {
    const candidate = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const existing = await Product.findOne({
      where: {
        slug: candidate,
        ...(excludeProductId && excludeProductId > 0
          ? { id: { [Op.ne]: excludeProductId } }
          : {}),
      } as any,
      attributes: ["id"],
    });

    if (!existing) return candidate;
  }

  return `${baseSlug}-${Date.now()}`;
};

const normalizeOptionalSlugInput = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return undefined;
  return buildProductSlugBase(value);
};

const SELLER_AUTHORING_EDITABLE_FIELDS = [
  "name",
  "description",
  "sku",
  "barcode",
  "slug",
  "categoryIds",
  "defaultCategoryId",
  "price",
  "salePrice",
  "stock",
  "imageUrls",
  "tags",
] as const;
const SELLER_AUTHORING_DEFERRED_FIELDS = [
  "categories",
  "videoPath",
  "notes",
  "status",
  "isPublished",
  "variations",
  "wholesale",
  "dangerousProduct",
  "preOrder",
  "preorderDays",
  "weight",
  "dimensions",
  "gtin",
  "condition",
  "parentSku",
  "youtubeLink",
] as const;

const resolveSellerCategoryReference = async () => {
  const rows = await Category.findAll({
    where: { published: true } as any,
    attributes: ["id", "name", "code", "parentId", "published"],
    order: [
      ["parentId", "ASC"],
      ["name", "ASC"],
    ],
  });

  return rows.map((category: any) => ({
    id: toNumber(getAttr(category, "id"), 0) || null,
    name: String(getAttr(category, "name") || ""),
    code: getAttr(category, "code") ? String(getAttr(category, "code")) : null,
    parentId: toNumber(getAttr(category, "parentId"), 0) || null,
    published: Boolean(getAttr(category, "published")),
  }));
};

const assertCategoryIdsExist = async (categoryIds: number[]) => {
  if (!categoryIds.length) return;
  const rows = await Category.findAll({
    where: {
      id: { [Op.in]: categoryIds },
      published: true,
    } as any,
    attributes: ["id"],
  });
  const existingIds = new Set(rows.map((row: any) => Number(getAttr(row, "id"))));
  const missing = categoryIds.filter((id) => !existingIds.has(Number(id)));

  if (missing.length > 0) {
    const error = new Error(
      `Selected categories were not found or are not published: ${missing.join(", ")}`
    );
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_CATEGORY_INVALID";
    throw error;
  }
};

const resolveSellerCategorySelection = async (input: any) => {
  const hasCategoryIds = typeof input?.categoryIds !== "undefined";
  const hasDefaultCategoryId = typeof input?.defaultCategoryId !== "undefined";

  const categoryIds = hasCategoryIds ? normalizeCategoryIdsInput(input?.categoryIds) || [] : [];
  const defaultCategoryId = hasDefaultCategoryId
    ? parseOptionalPositiveId(input?.defaultCategoryId)
    : null;

  if (!hasCategoryIds && !hasDefaultCategoryId) {
    return {
      categoryIds: [],
      defaultCategoryId: null,
      categoryId: null,
    };
  }

  if (categoryIds.length > 0 && defaultCategoryId === null) {
    const error = new Error(
      "defaultCategoryId is required when categoryIds are provided."
    );
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_DEFAULT_CATEGORY_REQUIRED";
    throw error;
  }

  if (defaultCategoryId !== null && !categoryIds.includes(defaultCategoryId)) {
    const error = new Error("defaultCategoryId must belong to categoryIds.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_DEFAULT_CATEGORY_INVALID";
    throw error;
  }

  await assertCategoryIdsExist(categoryIds);

  return {
    categoryIds,
    defaultCategoryId,
    categoryId: defaultCategoryId,
  };
};

const syncProductCategoryAssignments = async (
  productId: number,
  categoryIds: number[],
  transaction?: any
) => {
  const existingRows = await ProductCategory.findAll({
    where: { productId } as any,
    attributes: ["categoryId"],
    ...(transaction ? { transaction } : {}),
  });
  const existingIds = existingRows
    .map((row: any) => Number(getAttr(row, "categoryId")))
    .filter((id) => id > 0);
  const nextIds = Array.from(
    new Set(categoryIds.map((id) => Number(id)).filter((id) => id > 0))
  );
  const idsToDelete = existingIds.filter((id) => !nextIds.includes(id));
  const idsToCreate = nextIds.filter((id) => !existingIds.includes(id));

  if (idsToDelete.length > 0) {
    await ProductCategory.destroy({
      where: { productId, categoryId: { [Op.in]: idsToDelete } } as any,
      ...(transaction ? { transaction } : {}),
    });
  }

  if (idsToCreate.length > 0) {
    await ProductCategory.bulkCreate(
      idsToCreate.map((categoryId) => ({ productId, categoryId })) as any,
      {
        ignoreDuplicates: true,
        ...(transaction ? { transaction } : {}),
      }
    );
  }
};

const buildAuthoringPermissions = (sellerAccess: any = null) => {
  return {
    canCreateDraft: sellerHasPermission(sellerAccess, "PRODUCT_CREATE"),
    canEditDrafts: sellerHasPermission(sellerAccess, "PRODUCT_EDIT"),
    canSubmitDrafts: sellerHasPermission(sellerAccess, "PRODUCT_EDIT"),
    canPublishProducts: sellerHasPermission(sellerAccess, "PRODUCT_PUBLISH"),
  };
};

const buildSellerSubmissionGovernance = (
  sellerAccess: any = null,
  options: any = {}
) => {
  const permissions = buildAuthoringPermissions(sellerAccess);
  const productStatus = normalizeProductStatus(options?.productStatus);
  const submissionStatus = normalizeSellerSubmissionStatus(options?.submissionStatus);
  const hasConcreteProduct = Boolean(options?.hasConcreteProduct);
  const isResubmission = submissionStatus === "needs_revision";
  const sellerCanPublish =
    permissions.canPublishProducts && submissionStatus === "none";
  const canSubmit =
    hasConcreteProduct &&
    permissions.canSubmitDrafts &&
    productStatus === "draft" &&
    ["none", "needs_revision"].includes(submissionStatus);

  return {
    status: submissionStatus,
    reviewState:
      submissionStatus === "submitted"
        ? "PENDING_REVIEW"
        : submissionStatus === "needs_revision"
          ? "NEEDS_REVISION"
          : "NOT_SUBMITTED",
    canSubmitWhenEnabled: canSubmit,
    canResubmitWhenEnabled: canSubmit && isResubmission,
    canEditAfterSubmit: false,
    editLockAppliesWhenSubmitted: true,
    sellerCanPublish,
    requiresSellerChanges: submissionStatus === "needs_revision",
    note:
      submissionStatus === "submitted"
        ? "This product is locked while admin review is in progress. Seller edits and publish changes stay blocked until admin finishes the review or requests revisions."
        : submissionStatus === "needs_revision"
          ? "Admin requested revisions on this draft. Update the requested changes first, then resubmit for review before publish can continue."
        : hasConcreteProduct
          ? "Seller may keep this product as an internal draft or publish it directly while no admin review is in progress."
          : "You can create a draft first, then publish it directly when the required fields are ready.",
  };
};

const buildSellerNextActionState = (options: any = {}) => {
  const productStatus = normalizeProductStatus(options?.productStatus);
  const submissionStatus = normalizeSellerSubmissionStatus(options?.submissionStatus);
  const canEditDraft = Boolean(options?.canEditDraft);
  const canSubmit = Boolean(options?.canSubmit);
  const canResubmit = Boolean(options?.canResubmit);
  const visibilityState = String(options?.visibilityState || "").trim().toUpperCase();

  if (submissionStatus === "submitted") {
    return {
      code: "WAIT_ADMIN_REVIEW",
      label: "Waiting on Admin",
      description:
        "This draft is with admin review now. Seller editing stays locked until admin asks for changes or finishes the review.",
    };
  }

  if (submissionStatus === "needs_revision") {
    return {
      code: canEditDraft ? "CONTINUE_REVISION" : "REVISION_LOCKED",
      label: canEditDraft ? "Continue Revision" : "Revision Locked",
      description: canResubmit
        ? "Update the requested changes, then send this draft back for admin review."
        : "Admin requested changes before this draft can move forward again.",
    };
  }

  if (productStatus === "draft" && canSubmit) {
    return {
      code: "SUBMIT_REVIEW",
      label: "Submit for Review",
      description:
        "This draft is still with the seller. Finish the remaining updates, then send it to admin review.",
    };
  }

  if (productStatus === "draft" && canEditDraft) {
    return {
      code: "EDIT_DRAFT",
      label: "Edit Draft",
      description:
        "This draft is still open in seller workspace. Complete the remaining fields before sending it for review.",
    };
  }

  if (visibilityState === "STOREFRONT_VISIBLE") {
    return {
      code: "VISIBLE_IN_STOREFRONT",
      label: "Visible in Storefront",
      description:
        "This product is already visible to customers under the current publish and lifecycle rules.",
    };
  }

  return {
    code: "VIEW_STATUS",
    label: "Check Status",
    description:
      "No seller action is open right now. Check the current lifecycle and storefront visibility state instead.",
  };
};

const serializeSellerSubmissionState = (
  product: any,
  sellerAccess: any = null,
  options: any = {}
) => {
  const status = normalizeSellerSubmissionStatus(getAttr(product, "sellerSubmissionStatus"));
  const productStatus = normalizeProductStatus(options?.productStatus ?? getAttr(product, "status"));
  const submittedAt = getAttr(product, "sellerSubmittedAt") || null;
  const submittedByUserId = toNumber(getAttr(product, "sellerSubmittedByUserId"), 0) || null;
  const revisionRequestedAt = getAttr(product, "sellerRevisionRequestedAt") || null;
  const revisionRequestedByUserId =
    toNumber(getAttr(product, "sellerRevisionRequestedByUserId"), 0) || null;
  const revisionNote = nullableString(getAttr(product, "sellerRevisionNote"));
  const authoringState =
    options?.authoringState ??
    buildProductAuthoringState(productStatus, sellerAccess, status);
  const submissionGovernance =
    options?.submissionGovernance ??
    buildSellerSubmissionGovernance(sellerAccess, {
      hasConcreteProduct: true,
      productStatus,
      submissionStatus: status,
    });
  const visibilityState = String(options?.visibilityState || "").trim();
  const nextAction = buildSellerNextActionState({
    productStatus,
    submissionStatus: status,
    canEditDraft: authoringState?.canEditDraft,
    canSubmit: submissionGovernance?.canSubmitWhenEnabled,
    canResubmit: submissionGovernance?.canResubmitWhenEnabled,
    visibilityState,
  });

  return {
    status,
    label:
      status === "submitted"
        ? "Submitted for review"
        : status === "needs_revision"
          ? "Needs revision"
          : "Not submitted",
    hasSubmission: status !== "none",
    submittedAt,
    submittedByUserId,
    reviewState:
      status === "submitted"
        ? "PENDING_REVIEW"
        : status === "needs_revision"
          ? "NEEDS_REVISION"
          : "NOT_SUBMITTED",
    storefrontImpact: "NO_VISIBILITY_CHANGE",
    revisionRequestedAt,
    revisionRequestedByUserId,
    revisionNote,
    reviewNote: revisionNote,
    revisionReason: revisionNote,
    requiresSellerChanges: status === "needs_revision",
    canSubmit: Boolean(submissionGovernance?.canSubmitWhenEnabled),
    canResubmit: Boolean(submissionGovernance?.canResubmitWhenEnabled),
    canEdit: Boolean(authoringState?.canEditDraft),
    nextActionCode: nextAction.code,
    nextActionLabel: nextAction.label,
    nextActionDescription: nextAction.description,
  };
};

const buildProductAuthoringState = (
  status: string,
  sellerAccess: any = null,
  submissionStatus: string = "none"
) => {
  const permissions = buildAuthoringPermissions(sellerAccess);
  const normalizedSubmissionStatus =
    normalizeSellerSubmissionStatus(submissionStatus);

  if (!permissions.canEditDrafts) {
    return {
      canEditDraft: false,
      editBlockedReason: "PRODUCT_EDIT_PERMISSION_REQUIRED",
      allowedStatuses: ["draft", "active", "inactive"],
    };
  }

  if (!["draft", "active", "inactive"].includes(status)) {
    return {
      canEditDraft: false,
      editBlockedReason: "PRODUCT_STATUS_NOT_EDITABLE",
      allowedStatuses: ["draft", "active", "inactive"],
    };
  }

  if (normalizedSubmissionStatus === "submitted") {
    return {
      canEditDraft: false,
      editBlockedReason: "SELLER_PRODUCT_SUBMISSION_LOCKED",
      allowedStatuses: ["draft", "active", "inactive"],
    };
  }

  return {
    canEditDraft: true,
    editBlockedReason: null,
    allowedStatuses: ["draft", "active", "inactive"],
  };
};

const buildFieldGovernance = () => ({
  sellerEditableNow: [...SELLER_AUTHORING_EDITABLE_FIELDS],
  sellerReadOnly: [
    "promoImagePath",
    "imagePaths",
    "videoPath",
    "notes",
    "status",
    "isPublished",
    "variations",
    "wholesale",
    "weight",
    "dimensions",
    "dangerousProduct",
    "preOrder",
    "preorderDays",
    "gtin",
    "condition",
    "parentSku",
    "youtubeLink",
  ],
  adminOwned: ["status", "isPublished", "storeId", "userId", "notes"],
  deferred: [...SELLER_AUTHORING_DEFERRED_FIELDS],
});

const parseSellerProductDraftPayload = async (body: any = {}) => {
  const allowedFieldSet = new Set(SELLER_AUTHORING_EDITABLE_FIELDS);
  const bodyEntries =
    body && typeof body === "object" && !Array.isArray(body) ? Object.entries(body) : [];
  const forbiddenFields = bodyEntries
    .map(([key]) => String(key || "").trim())
    .filter((key) => key && !allowedFieldSet.has(key as any));

  if (forbiddenFields.length > 0) {
    const error = new Error("Seller product authoring payload contains read-only fields.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_AUTHORING_FORBIDDEN_FIELDS";
    (error as any).fields = forbiddenFields;
    throw error;
  }

  const name = normalizeString(body?.name);
  if (!name) {
    const error = new Error("Product name is required.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_NAME_REQUIRED";
    throw error;
  }

  if (name.length > 255) {
    const error = new Error("Product name must be 255 characters or fewer.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_NAME_TOO_LONG";
    throw error;
  }

  const description = nullableString(body?.description);
  const sku = nullableString(body?.sku);
  const barcode = nullableString(body?.barcode);
  const slug = normalizeOptionalSlugInput(body?.slug);
  const categorySelection = await resolveSellerCategorySelection(body);
  const price = normalizeOptionalMoney(body?.price);
  const salePrice = normalizeOptionalMoney(body?.salePrice);
  const stock = normalizeOptionalInteger(body?.stock);
  const hasImageUrls = Array.isArray(body?.imageUrls);
  const tags = normalizeTagListInput(body?.tags);
  const imageUrls = hasImageUrls
    ? Array.from(
        new Set(
          body.imageUrls
            .map((entry: unknown) => normalizeProductImageUrl(entry))
            .filter(Boolean)
        )
      )
    : undefined;

  if (sku && sku.length > 100) {
    const error = new Error("SKU must be 100 characters or fewer.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_SKU_TOO_LONG";
    throw error;
  }

  if (barcode && barcode.length > 100) {
    const error = new Error("Barcode must be 100 characters or fewer.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_BARCODE_TOO_LONG";
    throw error;
  }

  if (typeof slug === "string" && !slug) {
    const error = new Error("Slug is invalid.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_SLUG_INVALID";
    throw error;
  }

  if (typeof price === "number" && (!Number.isFinite(price) || price < 0)) {
    const error = new Error("Price must be a valid non-negative number.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_PRICE_INVALID";
    throw error;
  }

  if (
    typeof salePrice === "number" &&
    (!Number.isFinite(salePrice) || salePrice < 0)
  ) {
    const error = new Error("Sale price must be a valid non-negative number.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_SALE_PRICE_INVALID";
    throw error;
  }

  if (
    typeof price === "number" &&
    typeof salePrice === "number" &&
    salePrice > 0 &&
    salePrice >= price
  ) {
    const error = new Error("Sale price must stay lower than the base price.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_SALE_PRICE_TOO_HIGH";
    throw error;
  }

  if (typeof stock === "number" && (!Number.isFinite(stock) || stock < 0)) {
    const error = new Error("Stock must be a valid non-negative integer.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_STOCK_INVALID";
    throw error;
  }

  if (hasImageUrls && !imageUrls) {
    const error = new Error("Product image payload must be an array of URLs.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMAGES_INVALID";
    throw error;
  }

  if (Array.isArray(imageUrls) && imageUrls.length > 6) {
    const error = new Error("Seller draft images are limited to 6 items.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMAGES_LIMIT_EXCEEDED";
    throw error;
  }

  if (
    hasImageUrls &&
    Array.isArray(body?.imageUrls) &&
    body.imageUrls.some((entry: unknown) => !normalizeProductImageUrl(entry))
  ) {
    const error = new Error(
      "Product images must use uploaded /uploads paths or absolute http(s) URLs."
    );
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMAGE_URL_INVALID";
    throw error;
  }

  return {
    name,
    description,
    sku,
    barcode,
    slug,
    categoryIds: categorySelection.categoryIds,
    defaultCategoryId: categorySelection.defaultCategoryId,
    categoryId: categorySelection.categoryId,
    price: typeof price === "number" ? price : undefined,
    salePrice:
      typeof salePrice === "number" ? (salePrice > 0 ? salePrice : null) : undefined,
    stock: typeof stock === "number" ? stock : undefined,
    imageUrls,
    tags,
  };
};

const buildSellerSubmissionResetPatch = () => ({
  sellerSubmissionStatus: "none",
  sellerSubmittedAt: null,
  sellerSubmittedByUserId: null,
  sellerRevisionRequestedAt: null,
  sellerRevisionRequestedByUserId: null,
  sellerRevisionNote: null,
});

const resolveReferencedSellerProductIds = async (productIds: number[]) => {
  if (!productIds.length) return [];

  const [orderRefs, suborderRefs, reviewRefs] = await Promise.all([
    OrderItem.findAll({
      where: { productId: { [Op.in]: productIds } } as any,
      attributes: ["productId"],
      group: ["productId"],
      raw: true,
    }),
    SuborderItem.findAll({
      where: { productId: { [Op.in]: productIds } } as any,
      attributes: ["productId"],
      group: ["productId"],
      raw: true,
    }),
    ProductReview.findAll({
      where: { productId: { [Op.in]: productIds } } as any,
      attributes: ["productId"],
      group: ["productId"],
      raw: true,
    }),
  ]);

  return Array.from(
    new Set(
      [...orderRefs, ...suborderRefs, ...reviewRefs]
        .map((entry: any) => Number(entry?.productId))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  );
};

const deleteSellerProductsSafely = async (productIds: number[]) => {
  const uniqueIds = Array.from(
    new Set(productIds.filter((value) => Number.isInteger(value) && value > 0))
  );
  if (!uniqueIds.length) {
    return {
      affected: 0,
      blockedIds: [],
    };
  }

  const blockedIds = await resolveReferencedSellerProductIds(uniqueIds);
  const deletableIds = uniqueIds.filter((id) => !blockedIds.includes(id));

  if (!deletableIds.length) {
    return {
      affected: 0,
      blockedIds,
    };
  }

  const affected = await sequelize.transaction(async (transaction) => {
    await ProductCategory.destroy({
      where: { productId: { [Op.in]: deletableIds } } as any,
      transaction,
    });
    await CartItem.destroy({
      where: { productId: { [Op.in]: deletableIds } } as any,
      transaction,
    });
    return Product.destroy({
      where: { id: { [Op.in]: deletableIds } } as any,
      transaction,
    });
  });

  return {
    affected,
    blockedIds,
  };
};

const archiveSellerProductsSafely = async (productIds: number[]) => {
  const uniqueIds = Array.from(
    new Set(productIds.filter((value) => Number.isInteger(value) && value > 0))
  );
  if (!uniqueIds.length) {
    return {
      affected: 0,
      archivedIds: [],
    };
  }

  await sequelize.transaction(async (transaction) => {
    await Product.update(
      {
        isPublished: false,
        status: "inactive",
        ...buildSellerSubmissionResetPatch(),
      } as any,
      {
        where: { id: { [Op.in]: uniqueIds } } as any,
        transaction,
      }
    );
  });

  return {
    affected: uniqueIds.length,
    archivedIds: uniqueIds,
  };
};

const resolveSellerPublishReadiness = (product: any) => {
  const blockers: Array<{ field: string; code: string; message: string }> = [];
  const name = normalizeString(getAttr(product, "name"));
  const slug = normalizeString(getAttr(product, "slug"));
  const defaultCategoryId = toNumber(
    getAttr(product, "defaultCategoryId") ?? getAttr(product, "categoryId"),
    0
  );
  const price = Number(getAttr(product, "price"));
  const salePriceRaw = getAttr(product, "salePrice");
  const salePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : Number(salePriceRaw);
  const stock = Number(getAttr(product, "stock"));

  if (!name) {
    blockers.push({
      field: "name",
      code: "NAME_REQUIRED",
      message: "Product name is required before publishing.",
    });
  }

  if (!slug) {
    blockers.push({
      field: "slug",
      code: "SLUG_REQUIRED",
      message: "Product slug is required before publishing.",
    });
  }

  if (!Number.isInteger(defaultCategoryId) || defaultCategoryId <= 0) {
    blockers.push({
      field: "category",
      code: "CATEGORY_REQUIRED",
      message: "Choose a default category before publishing.",
    });
  }

  if (!Number.isFinite(price) || price <= 0) {
    blockers.push({
      field: "price",
      code: "PRICE_REQUIRED",
      message: "Base price must be greater than zero before publishing.",
    });
  }

  if (
    salePrice !== null &&
    (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= price)
  ) {
    blockers.push({
      field: "salePrice",
      code: "SALE_PRICE_INVALID",
      message: "Sale price must stay lower than the base price.",
    });
  }

  if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) {
    blockers.push({
      field: "stock",
      code: "STOCK_INVALID",
      message: "Stock must be a valid non-negative whole number before publishing.",
    });
  }

  return {
    isReady: blockers.length === 0,
    blockers,
  };
};

const findSellerScopedProductDetail = async (storeId: number, productId: number) =>
  Product.findOne({
    where: {
      id: productId,
      storeId,
    },
    attributes: [
      "id",
      "storeId",
      "name",
      "slug",
      "sku",
      "barcode",
      "gtin",
      "categoryId",
      "defaultCategoryId",
      "status",
      "isPublished",
      "sellerSubmissionStatus",
      "sellerSubmittedAt",
      "sellerSubmittedByUserId",
      "sellerRevisionRequestedAt",
      "sellerRevisionRequestedByUserId",
      "sellerRevisionNote",
      "price",
      "salePrice",
      "stock",
      "description",
      "notes",
      "promoImagePath",
      "imagePaths",
      "videoPath",
      "tags",
      "weight",
      "parentSku",
      "condition",
      "length",
      "width",
      "height",
      "dangerousProduct",
      "preOrder",
      "preorderDays",
      "youtubeLink",
      "variations",
      "wholesale",
      "createdAt",
      "updatedAt",
    ],
    include: [
      {
        model: Category,
        as: "category",
        attributes: ["id", "name", "code"],
        required: false,
      },
      {
        model: Category,
        as: "defaultCategory",
        attributes: ["id", "name", "code"],
        required: false,
      },
      {
        model: Category,
        as: "categories",
        attributes: ["id", "name", "code"],
        through: { attributes: [] },
        required: false,
      },
    ],
  });

const buildCatalogReadContract = () => ({
  sourceOfTruth: {
    tenantScope: "Product.storeId",
    storeLifecycle: "Store.status",
    status: "Product.status",
    publishFlag: "Product.isPublished",
    submissionGate: "Product.sellerSubmissionStatus",
    storefrontVisibility:
      "Product.storeId valid && Store.status === ACTIVE && Product.isPublished === true && Product.status === active && Product.sellerSubmissionStatus === none",
  },
  supportedStatuses: ["active", "inactive", "draft"],
  notes: [
    "Seller catalog stays store-scoped through Product.storeId.",
    "Current public storefront queries gate product visibility by store mapping, active store status, publish flag, active product status, and a cleared seller submission state.",
    "Submitted and revision-required products stay blocked from storefront visibility until admin review is resolved and Product.sellerSubmissionStatus returns to none.",
    "Stock, pre-order, and category publish state are still not used as hard storefront visibility gates in product queries.",
  ],
});

const serializeProductStatus = (status: string) => ({
  code: status,
  label: status === "active" ? "Active" : status === "inactive" ? "Inactive" : "Draft",
  storefrontEligible: status === "active",
  operationalMeaning:
    status === "active"
      ? "Product is operationally active and can become public when publish is on."
      : status === "inactive"
        ? "Product stays attached to the store but is blocked from public storefront queries."
        : "Product is still draft and blocked from public storefront queries.",
});

const serializeProductVisibility = (
  isPublished: boolean,
  status: string,
  submissionStatus: string = "none",
  options: {
    store?: any;
    storeOperationalReadiness?: any;
    storeStatus?: unknown;
    storeId?: unknown;
  } = {}
) =>
  buildProductVisibilitySnapshot({
    isPublished,
    status,
    submissionStatus,
    store: options.store,
    storeOperationalReadiness: options.storeOperationalReadiness,
    storeStatus: options.storeStatus,
    storeId: options.storeId,
  });

const serializeProductPublishing = (
  product: any,
  sellerAccess: any = null,
  readiness = resolveSellerPublishReadiness(product),
  options: {
    store?: any;
    storeOperationalReadiness?: any;
    storeStatus?: unknown;
    storeId?: unknown;
  } = {}
) => {
  const permissions = buildAuthoringPermissions(sellerAccess);
  const isPublished = Boolean(getAttr(product, "isPublished"));
  const status = normalizeProductStatus(getAttr(product, "status"));
  const submissionStatus = normalizeSellerSubmissionStatus(
    getAttr(product, "sellerSubmissionStatus")
  );
  const visibility = buildProductVisibilitySnapshot({
    isPublished,
    status,
    submissionStatus,
    store: options.store,
    storeOperationalReadiness: options.storeOperationalReadiness,
    storeStatus: options.storeStatus,
    storeId: options.storeId ?? getAttr(product, "storeId"),
  });
  const reviewBlocker =
    submissionStatus === "submitted"
      ? {
          field: "submission",
          code: "SELLER_REVIEW_PENDING",
          message:
            "Admin review is still in progress. Publish changes stay locked until the review is completed.",
        }
      : submissionStatus === "needs_revision"
        ? {
            field: "submission",
            code: "SELLER_REVISION_REQUIRED",
            message:
              "Admin requested revisions. Update the draft and resubmit before changing publish visibility.",
          }
        : null;
  const blockedReasons = reviewBlocker
    ? [reviewBlocker, ...readiness.blockers]
    : readiness.blockers;
  const canPublish =
    permissions.canPublishProducts &&
    !isPublished &&
    readiness.isReady &&
    !reviewBlocker;
  const canUnpublish =
    permissions.canPublishProducts &&
    isPublished &&
    !reviewBlocker;
  const stateCode = isPublished ? "PUBLISHED" : status === "draft" ? "DRAFT" : "UNPUBLISHED";

  return {
    stateCode,
    isPublished,
    label:
      stateCode === "PUBLISHED"
        ? "Published"
        : stateCode === "DRAFT"
          ? "Draft"
          : "Unpublished",
    isReady: readiness.isReady,
    canPublish,
    canUnpublish,
    blockedReasons,
    nextActionLabel: canPublish
      ? "Publish"
      : canUnpublish
        ? "Unpublish"
        : reviewBlocker
          ? submissionStatus === "submitted"
            ? "Waiting Review"
            : "Complete Revision"
        : stateCode === "DRAFT"
          ? "Complete draft"
          : "Update product",
    hint: canPublish
      ? visibility.storefrontVisible
        ? "This product is ready for storefront visibility."
        : visibility.reasonCode === "STORE_NOT_ACTIVE" || visibility.reasonCode === "STORE_NOT_READY"
          ? visibility.storefrontReason
          : "This product is ready for publish control."
      : canUnpublish
        ? visibility.storefrontVisible
          ? "This product is live and can be hidden from storefront at any time."
          : visibility.storefrontReason
        : reviewBlocker?.message ||
          blockedReasons[0]?.message ||
          (permissions.canPublishProducts
            ? "Update the remaining required fields before publishing."
            : "Your current seller access does not include publish control."),
  };
};

const serializeProductAvailability = (
  stock: number,
  options: { preOrder?: boolean; preorderDays?: number | null } = {}
) => {
  const preOrder = Boolean(options.preOrder);
  const preorderDays = options.preorderDays || null;
  const inStock = stock > 0;
  const stateCode = preOrder
    ? "PREORDER"
    : inStock
      ? "IN_STOCK"
      : "OUT_OF_STOCK";

  return {
    stock,
    inStock,
    preOrder,
    preorderDays,
    stateCode,
    label: preOrder
      ? `Pre-order${preorderDays ? ` (${preorderDays} day${preorderDays === 1 ? "" : "s"})` : ""}`
      : inStock
        ? "In stock"
        : "Out of stock",
    storefrontImpact: "NO_VISIBILITY_CHANGE",
    storefrontReason:
      "Storefront listing visibility stays unchanged, but add-to-cart and checkout now block items that are out of stock or no longer purchasable.",
  };
};

const buildCatalogGovernance = (sellerAccess: any = null, options: any = {}) => {
  const permissions = buildAuthoringPermissions(sellerAccess);
  const productStatus = normalizeProductStatus(options?.productStatus);
  const submissionStatus = normalizeSellerSubmissionStatus(options?.submissionStatus);
  const authoringState = buildProductAuthoringState(
    productStatus,
    sellerAccess,
    submissionStatus
  );

  return {
    mode: "FULL_AUTHORITY_PHASE_1",
    roleCode: sellerAccess?.roleCode ? String(sellerAccess.roleCode) : null,
    canCreate: permissions.canCreateDraft,
    canEdit: permissions.canEditDrafts,
    canDelete: sellerHasPermission(sellerAccess, "PRODUCT_ARCHIVE"),
    canPublish: permissions.canPublishProducts,
    canManagePricing: true,
    canManageInventory: true,
    canManageMedia: true,
    sourceOfTruth: "SELLER_PRODUCT_WORKSPACE",
    note:
      submissionStatus === "submitted"
        ? "Seller workspace remains the source of truth for the draft, but the submitted review lane is temporarily locked until admin finishes the review."
        : submissionStatus === "needs_revision"
          ? "Seller workspace remains the source of truth for the draft. Apply the requested changes here, then resubmit for admin review."
          : "Seller workspace owns store-scoped product authoring and publish visibility for products that are not currently in the admin review lane.",
    authoring: {
      phase: "FULL_AUTHORITY_PHASE_1",
      phaseLabel: "Seller Full Authority",
      writeLaneActive: true,
      recommendedPhase1: "SELLER_PUBLISH_AUTHORITY",
      legacySellerRoutesPresent: true,
      legacySellerRoutesMounted: false,
      canCreateDraft: permissions.canCreateDraft,
      canEditDraft: authoringState.canEditDraft,
      editBlockedReason: authoringState.editBlockedReason,
      allowedWriteStatuses: authoringState.allowedStatuses,
      note:
        submissionStatus === "submitted"
          ? "This draft is locked while admin review is pending."
          : submissionStatus === "needs_revision"
            ? "This draft is open for revision updates so it can be resubmitted for review."
            : "Seller workspace may create and edit store-scoped products across draft, active, and inactive states with seller-safe core fields, then publish or unpublish them directly.",
    },
    submissionGovernance: buildSellerSubmissionGovernance(sellerAccess, options),
    statusGovernance: {
      productStatuses: ["draft", "active", "inactive"],
      publishFlag: "seller-owned",
      sellerStateTransitionsActive: true,
      note:
        submissionStatus === "none"
          ? "Seller publish actions set store-scoped products live by turning publish on and moving the lifecycle to active. Unpublish hides the product without removing store ownership."
          : "Submitted and revision-required products stay outside seller publish toggles until the admin review lane is resolved.",
    },
    fieldGovernance: buildFieldGovernance(),
  };
};

const serializeProductOwnership = (product: any) => ({
  storeId: toNumber(getAttr(product, "storeId")),
  tenantScoped: toNumber(getAttr(product, "storeId")) > 0,
});

const resolveProductPreviewImage = (product: any) => {
  const promoImagePath = normalizeString(getAttr(product, "promoImagePath"));
  if (promoImagePath) return promoImagePath;

  const imagePaths = getAttr(product, "imagePaths");
  if (Array.isArray(imagePaths) && imagePaths.length > 0) {
    const firstImage = normalizeString(imagePaths[0]);
    return firstImage || null;
  }

  return null;
};

const normalizeJsonValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") return null;
  return value;
};

const serializeCategorySummary = (category: any) => {
  if (!category) return null;
  return {
    id: toNumber(getAttr(category, "id"), 0) || null,
    name: String(getAttr(category, "name") || ""),
    code: getAttr(category, "code") ? String(getAttr(category, "code")) : null,
  };
};

const serializeProductListItem = (
  product: any,
  sellerAccess: any = null,
  storeContext: any = null
) => {
  const storeStatus = storeContext?.status ?? storeContext;
  const category =
    product?.defaultCategory ??
    product?.category ??
    product?.get?.("defaultCategory") ??
    product?.get?.("category") ??
    null;

  const price = toNumber(getAttr(product, "price"));
  const salePriceRaw = getAttr(product, "salePrice");
  const salePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const stock = toNumber(getAttr(product, "stock"));
  const isPublished = Boolean(getAttr(product, "isPublished"));
  const status = normalizeProductStatus(getAttr(product, "status"));
  const visibility = serializeProductVisibility(
    isPublished,
    status,
    normalizeSellerSubmissionStatus(getAttr(product, "sellerSubmissionStatus")),
    {
      store: storeContext?.store ?? null,
      storeOperationalReadiness: storeContext?.operationalReadiness ?? null,
      storeStatus,
      storeId: getAttr(product, "storeId"),
    }
  );
  const publishing = serializeProductPublishing(product, sellerAccess, undefined, {
    store: storeContext?.store ?? null,
    storeOperationalReadiness: storeContext?.operationalReadiness ?? null,
    storeStatus,
    storeId: getAttr(product, "storeId"),
  });
  const authoring = buildProductAuthoringState(status, sellerAccess, normalizeSellerSubmissionStatus(getAttr(product, "sellerSubmissionStatus")));
  const submissionGovernance = buildSellerSubmissionGovernance(sellerAccess, {
    hasConcreteProduct: true,
    productStatus: status,
    submissionStatus: getAttr(product, "sellerSubmissionStatus"),
  });
  const submission = serializeSellerSubmissionState(product, sellerAccess, {
    productStatus: status,
    authoringState: authoring,
    submissionGovernance,
    visibilityState: visibility.stateCode,
  });
  const availability = serializeProductAvailability(stock);

  return {
    id: toNumber(getAttr(product, "id")),
    storeId: toNumber(getAttr(product, "storeId")),
    name: String(getAttr(product, "name") || ""),
    slug: String(getAttr(product, "slug") || ""),
    sku: getAttr(product, "sku") ? String(getAttr(product, "sku")) : null,
    status,
    statusMeta: serializeProductStatus(status),
    published: isPublished,
    visibility,
    publishing,
    storefrontVisibilityState: visibility.stateCode,
    availability,
    pricing: {
      price,
      salePrice: salePrice && salePrice > 0 ? salePrice : null,
      effectivePrice: salePrice && salePrice > 0 ? salePrice : price,
    },
    inventory: {
      ...availability,
    },
    submission,
    authoring,
    ownership: serializeProductOwnership(product),
    mediaPreviewUrl: resolveProductPreviewImage(product),
    category: serializeCategorySummary(category),
    createdAt: getAttr(product, "createdAt") || null,
    updatedAt: getAttr(product, "updatedAt") || null,
  };
};

const serializeProductDetail = (
  product: any,
  sellerAccess: any = null,
  storeContext: any = null
) => {
  const storeStatus = storeContext?.status ?? storeContext;
  const defaultCategory =
    product?.defaultCategory ?? product?.get?.("defaultCategory") ?? null;
  const primaryCategory = product?.category ?? product?.get?.("category") ?? null;
  const categories = Array.isArray(product?.categories)
    ? product.categories
    : Array.isArray(product?.get?.("categories"))
      ? product.get("categories")
      : [];
  const promoImageUrl = resolveProductPreviewImage(product);
  const imagePaths = normalizeStoredImagePathList(getAttr(product, "imagePaths"));
  const imageUrls =
    promoImageUrl && !imagePaths.includes(promoImageUrl)
      ? [promoImageUrl, ...imagePaths]
      : imagePaths;
  const price = toNumber(getAttr(product, "price"));
  const salePriceRaw = getAttr(product, "salePrice");
  const salePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const status = normalizeProductStatus(getAttr(product, "status"));
  const isPublished = Boolean(getAttr(product, "isPublished"));
  const visibility = serializeProductVisibility(
    isPublished,
    status,
    normalizeSellerSubmissionStatus(getAttr(product, "sellerSubmissionStatus")),
    {
      store: storeContext?.store ?? null,
      storeOperationalReadiness: storeContext?.operationalReadiness ?? null,
      storeStatus,
      storeId: getAttr(product, "storeId"),
    }
  );
  const publishing = serializeProductPublishing(product, sellerAccess, undefined, {
    store: storeContext?.store ?? null,
    storeOperationalReadiness: storeContext?.operationalReadiness ?? null,
    storeStatus,
    storeId: getAttr(product, "storeId"),
  });
  const authoring = buildProductAuthoringState(status, sellerAccess, normalizeSellerSubmissionStatus(getAttr(product, "sellerSubmissionStatus")));
  const submissionGovernance = buildSellerSubmissionGovernance(sellerAccess, {
    hasConcreteProduct: true,
    productStatus: status,
    submissionStatus: getAttr(product, "sellerSubmissionStatus"),
  });
  const submission = serializeSellerSubmissionState(product, sellerAccess, {
    productStatus: status,
    authoringState: authoring,
    submissionGovernance,
    visibilityState: visibility.stateCode,
  });
  const stock = toNumber(getAttr(product, "stock"));
  const variations = normalizeJsonValue(getAttr(product, "variations"));
  const wholesale = normalizeJsonValue(getAttr(product, "wholesale"));
  const tags = normalizeJsonValue(getAttr(product, "tags"));
  const availability = serializeProductAvailability(stock, {
    preOrder: Boolean(getAttr(product, "preOrder")),
    preorderDays: toNumber(getAttr(product, "preorderDays"), 0) || null,
  });

  return {
    id: toNumber(getAttr(product, "id")),
    storeId: toNumber(getAttr(product, "storeId")),
    name: String(getAttr(product, "name") || ""),
    slug: String(getAttr(product, "slug") || ""),
    sku: getAttr(product, "sku") ? String(getAttr(product, "sku")) : null,
    status,
    statusMeta: serializeProductStatus(status),
    published: isPublished,
    visibility,
    publishing,
    storefrontVisibilityState: visibility.stateCode,
    availability,
    descriptions: {
      description: getAttr(product, "description")
        ? String(getAttr(product, "description"))
        : null,
      notes: getAttr(product, "notes") ? String(getAttr(product, "notes")) : null,
    },
    pricing: {
      price,
      salePrice: salePrice && salePrice > 0 ? salePrice : null,
      effectivePrice: salePrice && salePrice > 0 ? salePrice : price,
    },
    inventory: {
      ...availability,
    },
    submission,
    ownership: serializeProductOwnership(product),
    category: {
      primary: serializeCategorySummary(primaryCategory),
      default: serializeCategorySummary(defaultCategory),
      assigned: categories.map(serializeCategorySummary).filter(Boolean),
    },
    media: {
      promoImageUrl,
      imageUrls,
      videoUrl: getAttr(product, "videoPath") ? String(getAttr(product, "videoPath")) : null,
      totalImages: imageUrls.length,
    },
    attributes: {
      weight: toNumber(getAttr(product, "weight"), 0) || null,
      dimensions: {
        length: toNumber(getAttr(product, "length"), 0) || null,
        width: toNumber(getAttr(product, "width"), 0) || null,
        height: toNumber(getAttr(product, "height"), 0) || null,
      },
      condition: getAttr(product, "condition") ? String(getAttr(product, "condition")) : null,
      dangerousProduct: Boolean(getAttr(product, "dangerousProduct")),
      youtubeLink: getAttr(product, "youtubeLink")
        ? String(getAttr(product, "youtubeLink"))
        : null,
      parentSku: getAttr(product, "parentSku") ? String(getAttr(product, "parentSku")) : null,
      barcode: getAttr(product, "barcode") ? String(getAttr(product, "barcode")) : null,
      gtin: getAttr(product, "gtin") ? String(getAttr(product, "gtin")) : null,
      tags,
    },
    variations: {
      hasVariations: Array.isArray(variations)
        ? variations.length > 0
        : Boolean(variations && Object.keys(variations as Record<string, unknown>).length > 0),
      raw: variations,
    },
    wholesale: {
      hasWholesale: Array.isArray(wholesale)
        ? wholesale.length > 0
        : Boolean(wholesale && Object.keys(wholesale as Record<string, unknown>).length > 0),
      raw: wholesale,
    },
    authoring,
    governance: buildCatalogGovernance(sellerAccess, {
      hasConcreteProduct: true,
      productStatus: status,
      submissionStatus: submission.status,
    }),
    createdAt: getAttr(product, "createdAt") || null,
    updatedAt: getAttr(product, "updatedAt") || null,
  };
};

const buildSellerProductSummary = async (
  storeId: number,
  storeContext: any = null
) => {
  const baseWhere = { storeId } as any;
  const storeStatus = storeContext?.status ?? storeContext;
  const storefrontOperational =
    typeof storeContext?.isOperational === "boolean"
      ? storeContext.isOperational
      : isStorefrontStoreActive({ storeStatus, storeId });

  const [
    totalProducts,
    drafts,
    readyToSubmit,
    active,
    inactive,
    submitted,
    needsRevision,
    reviewQueue,
    storefrontVisible,
    publishedBlocked,
    internalOnly,
  ] = await Promise.all([
    Product.count({ where: baseWhere }),
    Product.count({ where: { ...baseWhere, status: "draft" } as any }),
    Product.count({
      where: {
        ...baseWhere,
        status: "draft",
        sellerSubmissionStatus: "none",
      } as any,
    }),
    Product.count({ where: { ...baseWhere, status: "active" } as any }),
    Product.count({ where: { ...baseWhere, status: "inactive" } as any }),
    Product.count({
      where: { ...baseWhere, sellerSubmissionStatus: "submitted" } as any,
    }),
    Product.count({
      where: { ...baseWhere, sellerSubmissionStatus: "needs_revision" } as any,
    }),
    Product.count({
      where: {
        ...baseWhere,
        sellerSubmissionStatus: {
          [Op.in]: ["submitted", "needs_revision"],
        },
      } as any,
    }),
    Product.count({
      where: {
        ...baseWhere,
        isPublished: true,
        status: "active",
        sellerSubmissionStatus: "none",
      } as any,
    }).then((count) => (storefrontOperational ? count : 0)),
    Product.count({
      where: storefrontOperational
        ? {
            ...baseWhere,
            isPublished: true,
            [Op.or]: [
              { status: { [Op.ne]: "active" } },
              {
                sellerSubmissionStatus: {
                  [Op.in]: ["submitted", "needs_revision"],
                },
              },
            ],
          } as any
        : {
            ...baseWhere,
            isPublished: true,
          } as any,
    }),
    Product.count({ where: { ...baseWhere, isPublished: false } as any }),
  ]);

  return {
    totalProducts,
    drafts,
    readyToSubmit,
    active,
    inactive,
    submitted,
    needsRevision,
    reviewQueue,
    storefrontVisible,
    publishedBlocked,
    internalOnly,
  };
};

const parseSellerProductsFilterInput = (source: any = {}) => ({
  keyword: normalizeString(source?.keyword),
  categoryIds: normalizePositiveIdFilterList(source?.categoryIds),
  status: normalizeString(source?.status).toLowerCase(),
  published: parseBooleanFilter(source?.published),
  submissionStatus: normalizeSellerSubmissionFilter(source?.submissionStatus),
  visibilityState: normalizeVisibilityStateFilter(source?.visibilityState),
  sort: normalizeSellerSort(source?.sort),
});

const buildSellerProductsWhere = async (options: any = {}) => {
  const andConditions: any[] = [];
  const ids = Array.isArray(options?.ids) ? options.ids : [];
  const categoryIds = Array.isArray(options?.categoryIds) ? options.categoryIds : [];
  const storeActive =
    typeof options?.storefrontOperational === "boolean"
      ? options.storefrontOperational
      : isStorefrontStoreActive({
          storeStatus: options?.storeStatus,
          storeId: options?.storeId,
        });

  if (allowedStatuses.has(options?.status)) {
    andConditions.push({ status: options.status });
  }

  if (typeof options?.published === "boolean") {
    andConditions.push({ isPublished: options.published });
  }

  if (options?.submissionStatus === "review_queue") {
    andConditions.push({
      sellerSubmissionStatus: {
        [Op.in]: ["submitted", "needs_revision"],
      },
    });
  } else if (options?.submissionStatus === "ready_to_submit") {
    andConditions.push({ status: "draft" });
    andConditions.push({ sellerSubmissionStatus: "none" });
  } else if (allowedSellerSubmissionStatuses.has(options?.submissionStatus)) {
    andConditions.push({ sellerSubmissionStatus: options.submissionStatus });
  }

  if (options?.visibilityState === "internal_only") {
    andConditions.push({ isPublished: false });
  } else if (options?.visibilityState === "storefront_visible") {
    if (storeActive) {
      andConditions.push(
        { isPublished: true },
        { status: "active" },
        { sellerSubmissionStatus: "none" }
      );
    } else {
      andConditions.push({ id: { [Op.eq]: 0 } });
    }
  } else if (options?.visibilityState === "published_blocked") {
    andConditions.push({ isPublished: true });
    if (storeActive) {
      andConditions.push({
        [Op.or]: [
          { status: { [Op.ne]: "active" } },
          {
            sellerSubmissionStatus: {
              [Op.in]: ["submitted", "needs_revision"],
            },
          },
        ],
      });
    }
  }

  if (options?.keyword) {
    const likeKeyword = `%${options.keyword}%`;
    andConditions.push({
      [Op.or]: [
        { name: { [Op.like]: likeKeyword } },
        { slug: { [Op.like]: likeKeyword } },
        { sku: { [Op.like]: likeKeyword } },
      ],
    });
  }

  if (categoryIds.length > 0) {
    const categoryRows = await ProductCategory.findAll({
      where: {
        categoryId: {
          [Op.in]: categoryIds,
        },
      } as any,
      attributes: ["productId"],
      raw: true,
    });
    const categoryProductIds = Array.from(
      new Set(
        categoryRows
          .map((row: any) => toNumber(row?.productId, 0))
          .filter((productId) => productId > 0)
      )
    );
    const categoryScopes: any[] = [
      { categoryId: { [Op.in]: categoryIds } },
      { defaultCategoryId: { [Op.in]: categoryIds } },
    ];

    if (categoryProductIds.length > 0) {
      categoryScopes.push({
        id: {
          [Op.in]: categoryProductIds,
        },
      });
    }

    andConditions.push({
      [Op.or]: categoryScopes,
    });
  }

  if (ids.length > 0) {
    andConditions.push({
      id: {
        [Op.in]: ids,
      },
    });
  }

  return {
    storeId: Number(options?.storeId),
    ...(andConditions.length > 0 ? { [Op.and]: andConditions } : {}),
  };
};

const buildSellerProductsOrder = (sort: unknown): Order => {
  const normalizedSort = normalizeSellerSort(sort);

  if (normalizedSort === "price_asc") {
    return [
      ["price", "ASC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ];
  }

  if (normalizedSort === "price_desc") {
    return [
      ["price", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ];
  }

  if (normalizedSort === "date_added") {
    return [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ];
  }

  return [
    ["updatedAt", "DESC"],
    ["id", "DESC"],
  ];
};

const loadSellerStorefrontVisibilityContext = async (storeId: number) => {
  const store = await Store.findByPk(storeId, {
    attributes: ["id", "status", "activeStorePaymentProfileId"],
    include: [
      {
        association: "paymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
      {
        association: "activePaymentProfile",
        attributes: [...STORE_PAYMENT_PROFILE_BASE_ATTRIBUTES],
        required: false,
      },
    ],
  });
  const operationalReadiness = store ? buildPublicStoreOperationalReadiness(store) : null;

  return {
    store,
    status: getAttr(store, "status") || null,
    operationalReadiness,
    isOperational: Boolean(operationalReadiness?.isReady),
  };
};

const sellerProductListAttributes = [
  "id",
  "storeId",
  "name",
  "slug",
  "sku",
  "status",
  "isPublished",
  "sellerSubmissionStatus",
  "sellerSubmittedAt",
  "sellerSubmittedByUserId",
  "sellerRevisionRequestedAt",
  "sellerRevisionRequestedByUserId",
  "sellerRevisionNote",
  "price",
  "salePrice",
  "stock",
  "promoImagePath",
  "imagePaths",
  "createdAt",
  "updatedAt",
];

const sellerProductListInclude = [
  {
    model: Category,
    as: "defaultCategory",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: Category,
    as: "category",
    attributes: ["id", "name", "code"],
    required: false,
  },
];

const fetchSellerProductListRows = async (where: any, options: any = {}) =>
  Product.findAll({
    where,
    attributes: [...sellerProductListAttributes],
    include: [...sellerProductListInclude],
    order: buildSellerProductsOrder(options?.sort),
    ...(typeof options?.limit === "number" ? { limit: options.limit } : {}),
    ...(typeof options?.offset === "number" ? { offset: options.offset } : {}),
  });

const toCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const buildSellerProductsCsv = (
  products: any[],
  sellerAccess: any = null,
  storeStatus: unknown = null
) => {
  const header = [
    "ID",
    "Name",
    "Slug",
    "SKU",
    "Category",
    "Price",
    "Sale Price",
    "Stock",
    "Lifecycle Status",
    "Submission Status",
    "Storefront Visibility",
    "Updated At",
  ];

  const rows = products.map((product) => {
    const item = serializeProductListItem(product, sellerAccess, storeStatus);
    return [
      item.id,
      item.name,
      item.slug,
      item.sku || "",
      item.category?.name || "",
      item.pricing?.price ?? 0,
      item.pricing?.salePrice ?? "",
      item.inventory?.stock ?? 0,
      item.statusMeta?.label || item.status,
      item.submission?.label || "Not submitted",
      item.visibility?.sellerLabel || item.visibility?.label || "Private",
      item.updatedAt || "",
    ];
  });

  return [header, ...rows].map((row) => row.map(toCsvCell).join(",")).join("\n");
};

const toSellerProductExportItem = (
  product: any,
  sellerAccess: any = null,
  storeContext: any = null
) => {
  const item = serializeProductListItem(product, sellerAccess, storeContext);
  const imagePaths = normalizeStoredImagePathList(getAttr(product, "imagePaths"));
  const previewImageUrl = resolveProductPreviewImage(product);

  return {
    id: item.id,
    storeId: item.storeId,
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    categoryId: item.category?.id ?? null,
    categoryCode: item.category?.code ?? null,
    categoryName: item.category?.name ?? null,
    price: item.pricing?.price ?? 0,
    salePrice: item.pricing?.salePrice ?? null,
    stock: item.inventory?.stock ?? 0,
    status: item.status,
    published: Boolean(item.published),
    submissionStatus: item.submission?.status ?? "none",
    submissionLabel: item.submission?.label ?? "Not submitted",
    inventoryStatus: item.inventory?.stateCode ?? null,
    inventoryLabel: item.inventory?.label ?? null,
    storefrontVisibility: item.visibility?.stateCode ?? null,
    storefrontVisibilityLabel:
      item.visibility?.sellerLabel || item.visibility?.label || "Private",
    previewImageUrl,
    imagePaths,
    imageUrls:
      previewImageUrl && !imagePaths.includes(previewImageUrl)
        ? [previewImageUrl, ...imagePaths]
        : imagePaths,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const splitCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  if (inQuotes) {
    const error = new Error("CSV contains an unclosed quoted field.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMPORT_CSV_INVALID";
    throw error;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const parseCsvImportRows = (text: string) => {
  const normalizedText = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!normalizedText) {
    const error = new Error("Import file is empty.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMPORT_EMPTY";
    throw error;
  }

  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    const error = new Error("CSV import requires a header row and at least one data row.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMPORT_CSV_EMPTY";
    throw error;
  }

  const header = splitCsvLine(lines[0]).map((cell) => normalizeString(cell).toLowerCase());
  if (!header.length) {
    const error = new Error("CSV import header is missing.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMPORT_CSV_HEADER_REQUIRED";
    throw error;
  }

  return lines.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const row: Record<string, unknown> = {};
    header.forEach((key, index) => {
      row[key] = values[index] ?? "";
    });
    return row;
  });
};

const parseSellerImportPayload = (file: any) => {
  const buffer = file?.buffer;
  if (!buffer) {
    const error = new Error("No file uploaded.");
    (error as any).status = 400;
    (error as any).code = "SELLER_PRODUCT_IMPORT_FILE_REQUIRED";
    throw error;
  }

  const originalName = normalizeString(file?.originalname).toLowerCase();
  const mimetype = normalizeString(file?.mimetype).toLowerCase();
  const rawText = buffer.toString("utf8");
  const looksLikeJson =
    originalName.endsWith(".json") ||
    mimetype === "application/json" ||
    mimetype.endsWith("+json");
  const looksLikeCsv =
    originalName.endsWith(".csv") ||
    mimetype === "text/csv" ||
    mimetype === "application/csv" ||
    mimetype === "application/vnd.ms-excel";

  if (looksLikeJson) {
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(rawText);
    } catch {
      const error = new Error("Invalid JSON file.");
      (error as any).status = 400;
      (error as any).code = "SELLER_PRODUCT_IMPORT_JSON_INVALID";
      throw error;
    }

    const items = Array.isArray(parsedPayload)
      ? parsedPayload
      : Array.isArray(parsedPayload?.items)
        ? parsedPayload.items
        : null;

    if (!items) {
      const error = new Error(
        "Import file must be a JSON array or an object with an `items` array."
      );
      (error as any).status = 400;
      (error as any).code = "SELLER_PRODUCT_IMPORT_JSON_ITEMS_REQUIRED";
      throw error;
    }

    return items;
  }

  if (looksLikeCsv) {
    return parseCsvImportRows(rawText);
  }

  const error = new Error("Seller import only accepts CSV or JSON files.");
  (error as any).status = 400;
  (error as any).code = "SELLER_PRODUCT_IMPORT_TYPE_UNSUPPORTED";
  throw error;
};

const normalizeSellerImportRow = (raw: any) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Each imported product row must be an object.");
  }

  const getRowValue = (...keys: string[]) => {
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(raw, key)) {
        return raw[key];
      }
    }
    return undefined;
  };

  const name =
    nullableString(
      getRowValue("title", "name", "productName", "product_name", "productname")
    ) || null;
  const slug = nullableString(getRowValue("slug"));
  const sku = nullableString(getRowValue("sku"));
  const barcode = nullableString(getRowValue("barcode"));
  const description = nullableString(getRowValue("description"));
  const storeId = parseOptionalPositiveId(getRowValue("storeId", "store_id", "storeid"));

  const categoryId =
    parseOptionalPositiveId(
      getRowValue(
        "categoryId",
        "category_id",
        "categoryid",
        "defaultCategoryId",
        "default_category_id",
        "defaultcategoryid"
      )
    ) ?? null;
  const categoryCode =
    nullableString(
      getRowValue(
        "categoryCode",
        "category_code",
        "categorycode",
        "defaultCategoryCode",
        "default_category_code",
        "defaultcategorycode"
      )
    ) ?? null;
  const categoryName =
    nullableString(
      getRowValue(
        "categoryName",
        "category_name",
        "categoryname",
        "defaultCategoryName",
        "default_category_name",
        "defaultcategoryname",
        "category",
        "defaultCategory"
      )
    ) ?? null;

  const price =
    getRowValue("price") === null ||
    typeof getRowValue("price") === "undefined" ||
    getRowValue("price") === ""
      ? undefined
      : normalizeOptionalMoney(getRowValue("price"));
  const salePrice =
    getRowValue("salePrice", "sale_price", "saleprice") === null ||
    typeof getRowValue("salePrice", "sale_price", "saleprice") === "undefined" ||
    getRowValue("salePrice", "sale_price", "saleprice") === ""
      ? undefined
      : normalizeOptionalMoney(getRowValue("salePrice", "sale_price", "saleprice"));
  const stock =
    getRowValue("stock") === null ||
    typeof getRowValue("stock") === "undefined" ||
    getRowValue("stock") === ""
      ? undefined
      : normalizeOptionalInteger(getRowValue("stock"));

  const tagsInput = getRowValue("tags");
  const imageUrlsInput = getRowValue("imageUrls", "image_urls", "imageurls");

  const tags = Array.isArray(tagsInput)
    ? tagsInput
    : typeof tagsInput === "string"
      ? tagsInput
          .split("|")
          .map((value: string) => value.trim())
          .filter(Boolean)
      : undefined;

  const imageUrls = Array.isArray(imageUrlsInput)
    ? imageUrlsInput
    : typeof imageUrlsInput === "string"
      ? imageUrlsInput
          .split("|")
          .map((value: string) => value.trim())
          .filter(Boolean)
      : undefined;

  return {
    name,
    slug,
    sku,
    barcode,
    description,
    storeId,
    categoryId,
    categoryCode,
    categoryName,
    price,
    salePrice,
    stock,
    tags,
    imageUrls,
  };
};

const resolveUniqueImportedSku = async (value: unknown) => {
  const sourceSku = normalizeString(value);
  if (!sourceSku) return null;

  for (let index = 0; index < 200; index += 1) {
    const suffix = index === 0 ? "" : index === 1 ? "-IMP" : `-IMP-${index}`;
    const candidate = `${sourceSku.slice(0, Math.max(0, 100 - suffix.length))}${suffix}`;
    const existing = await Product.findOne({
      where: { sku: candidate } as any,
      attributes: ["id"],
    });

    if (!existing) return candidate;
  }

  return null;
};

const resolveSellerImportCategoryId = async (input: {
  categoryId?: number | null;
  categoryCode?: string | null;
  categoryName?: string | null;
}) => {
  if (input.categoryId) {
    const category = await Category.findOne({
      where: { id: input.categoryId, published: true } as any,
      attributes: ["id"],
    });
    if (!category) {
      throw new Error(`Category id ${input.categoryId} was not found.`);
    }
    return Number((category as any).id);
  }

  if (input.categoryCode) {
    const category = await Category.findOne({
      where: { code: input.categoryCode, published: true } as any,
      attributes: ["id"],
    });
    if (!category) {
      throw new Error(`Category code ${input.categoryCode} was not found.`);
    }
    return Number((category as any).id);
  }

  if (input.categoryName) {
    const category = await Category.findOne({
      where: { name: input.categoryName, published: true } as any,
      attributes: ["id"],
    });
    if (!category) {
      throw new Error(`Category name ${input.categoryName} was not found.`);
    }
    return Number((category as any).id);
  }

  return null;
};

const validateSellerBulkSubmissionAction = (product: any, action: string) => {
  const currentStatus = normalizeProductStatus(getAttr(product, "status"));
  const currentSubmissionStatus = normalizeSellerSubmissionStatus(
    getAttr(product, "sellerSubmissionStatus")
  );

  if (currentStatus !== "draft") {
    return {
      ok: false,
      code: "SELLER_PRODUCT_SUBMISSION_DRAFT_REQUIRED",
      message: "Only draft products can move through seller submission bulk actions.",
    };
  }

  if (action === "submit_review") {
    if (currentSubmissionStatus === "submitted") {
      return {
        ok: false,
        code: "SELLER_PRODUCT_ALREADY_SUBMITTED",
        message: "This draft is already waiting for admin review.",
      };
    }

    if (currentSubmissionStatus === "needs_revision") {
      return {
        ok: false,
        code: "SELLER_PRODUCT_RESUBMISSION_REQUIRED",
        message: "Use resubmit review for drafts that already received a revision request.",
      };
    }

    return { ok: true };
  }

  if (action === "resubmit_review") {
    if (currentSubmissionStatus !== "needs_revision") {
      return {
        ok: false,
        code: "SELLER_PRODUCT_RESUBMISSION_STATE_INVALID",
        message: "Only drafts in needs revision can be resubmitted for admin review.",
      };
    }

    return { ok: true };
  }

  return {
    ok: false,
    code: "SELLER_PRODUCT_BULK_ACTION_INVALID",
    message: "Unsupported seller bulk action.",
  };
};

const buildSellerBulkSubmissionPatch = (actorUserId: number) => ({
  sellerSubmissionStatus: "submitted",
  sellerSubmittedAt: new Date(),
  sellerSubmittedByUserId: actorUserId > 0 ? actorUserId : null,
  sellerRevisionRequestedAt: null,
  sellerRevisionRequestedByUserId: null,
  sellerRevisionNote: null,
});

router.get(
  "/stores/:storeId/products/authoring/meta",
  requireSellerStoreAccess(["PRODUCT_VIEW"]),
  async (req, res) => {
    const sellerAccess = (req as any).sellerAccess;

    return res.json({
      success: true,
      data: {
        governance: buildCatalogGovernance(sellerAccess),
        draftDefaults: {
          status: "draft",
          published: false,
          submissionStatus: "none",
          name: "",
          description: "",
          sku: "",
          barcode: "",
          slug: "",
          categoryIds: [],
          defaultCategoryId: null,
          price: 0,
          salePrice: null,
          stock: 0,
          imageUrls: [],
          tags: [],
        },
        references: {
          categories: await resolveSellerCategoryReference(),
        },
      },
    });
  }
);

router.post(
  "/stores/:storeId/products/drafts",
  requireSellerStoreAccess(["PRODUCT_CREATE"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const actorUserId = Number((req as any).user?.id || 0);
      const payload = await parseSellerProductDraftPayload(req.body);
      const slug = await resolveUniqueProductSlug(payload.slug || payload.name);

      const product = await Product.create({
        name: payload.name,
        slug,
        description: payload.description || undefined,
        sku: payload.sku,
        barcode: payload.barcode,
        status: "draft",
        isPublished: false,
        sellerSubmissionStatus: "none",
        sellerSubmittedAt: null,
        sellerSubmittedByUserId: null,
        sellerRevisionRequestedAt: null,
        sellerRevisionRequestedByUserId: null,
        sellerRevisionNote: null,
        price: payload.price ?? 0,
        salePrice:
          typeof payload.salePrice === "undefined" ? null : payload.salePrice,
        stock: payload.stock ?? 0,
        categoryId: payload.categoryId,
        defaultCategoryId: payload.defaultCategoryId,
        promoImagePath: Array.isArray(payload.imageUrls) ? payload.imageUrls[0] || null : null,
        imagePaths: Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
        tags: Array.isArray(payload.tags) ? payload.tags : undefined,
        userId: actorUserId,
        storeId,
      } as any);

      if (payload.categoryIds.length > 0) {
        await syncProductCategoryAssignments(Number((product as any).id), payload.categoryIds);
      }

      const detail = await findSellerScopedProductDetail(storeId, Number((product as any).id));
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      await logProductActivity({
        storeId,
        entityId: Number((product as any).id),
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.CREATED,
        actorType: "seller",
        actorId: actorUserId,
        after: detail || product,
        metadata: {
          source: "manual",
          lane: "seller",
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess, storeContext),
          contract: buildCatalogReadContract(),
        },
      });
    } catch (error) {
      const status = Number((error as any)?.status || 500);
      if (status >= 400 && status < 500) {
        return res.status(status).json({
          success: false,
          code: (error as any)?.code || "SELLER_PRODUCT_DRAFT_CREATE_FAILED",
          message: (error as any)?.message || "Failed to create seller product draft.",
          ...(Array.isArray((error as any)?.fields) ? { fields: (error as any).fields } : {}),
        });
      }

      console.error("[seller/products/create-draft] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create seller product draft.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/products/:productId/draft",
  requireSellerStoreAccess(["PRODUCT_EDIT"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const productId = Number(req.params.productId);
      const actorUserId = Number((req as any).user?.id || 0);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_ID",
          message: "Invalid product id.",
        });
      }

      const payload = await parseSellerProductDraftPayload(req.body);
      const product = await Product.findOne({
        where: {
          id: productId,
          storeId,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          code: "SELLER_PRODUCT_NOT_FOUND",
          message: "Product not found for this seller store.",
        });
      }

      const currentStatus = normalizeProductStatus(getAttr(product, "status"));
      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        getAttr(product, "sellerSubmissionStatus")
      );
      if (!["draft", "active", "inactive"].includes(currentStatus)) {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_EDIT_STATE_INVALID",
          message: "This product is not editable from the seller product lane.",
        });
      }

      if (currentSubmissionStatus === "submitted") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_SUBMISSION_LOCKED",
          message: "This draft is already with admin review, so editing is locked for now.",
        });
      }

      const beforeSnapshot = product.get?.({ plain: true }) ?? product;

      const nextSlug =
        normalizeString(getAttr(product, "name")) !== payload.name ||
        normalizeString(getAttr(product, "slug")) !== normalizeString(payload.slug)
          ? await resolveUniqueProductSlug(payload.slug || payload.name, productId)
          : normalizeString(getAttr(product, "slug"));

      await product.update({
        name: payload.name,
        slug: nextSlug,
        description: payload.description,
        sku: payload.sku,
        barcode: payload.barcode,
        price: typeof payload.price === "number" ? payload.price : getAttr(product, "price"),
        salePrice:
          typeof payload.salePrice !== "undefined"
            ? payload.salePrice
            : getAttr(product, "salePrice"),
        stock: typeof payload.stock === "number" ? payload.stock : getAttr(product, "stock"),
        categoryId:
          typeof payload.defaultCategoryId !== "undefined"
            ? payload.categoryId
            : getAttr(product, "categoryId"),
        defaultCategoryId:
          typeof payload.defaultCategoryId !== "undefined"
            ? payload.defaultCategoryId
            : getAttr(product, "defaultCategoryId"),
        promoImagePath:
          Array.isArray(payload.imageUrls)
            ? payload.imageUrls[0] || null
            : getAttr(product, "promoImagePath"),
        imagePaths:
          Array.isArray(payload.imageUrls)
            ? payload.imageUrls
            : getAttr(product, "imagePaths"),
        tags:
          typeof payload.tags !== "undefined" ? payload.tags : getAttr(product, "tags"),
      } as any);

      await syncProductCategoryAssignments(productId, payload.categoryIds);

      const detail = await findSellerScopedProductDetail(storeId, productId);
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      await logProductActivity({
        storeId,
        entityId: productId,
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.UPDATED,
        actorType: "seller",
        actorId: actorUserId,
        before: beforeSnapshot,
        after: detail || product,
        metadata: {
          source: "manual",
          lane: "seller",
        },
      });

      return res.json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess, storeContext),
          contract: buildCatalogReadContract(),
        },
      });
    } catch (error) {
      const status = Number((error as any)?.status || 500);
      if (status >= 400 && status < 500) {
        return res.status(status).json({
          success: false,
          code: (error as any)?.code || "SELLER_PRODUCT_DRAFT_UPDATE_FAILED",
          message: (error as any)?.message || "Failed to update seller product draft.",
          ...(Array.isArray((error as any)?.fields) ? { fields: (error as any).fields } : {}),
        });
      }

      console.error("[seller/products/update-draft] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update seller product draft.",
      });
    }
  }
);

router.patch(
  "/stores/:storeId/products/:productId/published",
  requireSellerStoreAccess(["PRODUCT_PUBLISH"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const productId = Number(req.params.productId);
      const actorUserId = Number((req as any).user?.id || 0);
      const nextPublished = parseBooleanFilter(req.body?.published);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_ID",
          message: "Invalid product id.",
        });
      }

      if (nextPublished === null) {
        return res.status(400).json({
          success: false,
          code: "SELLER_PRODUCT_PUBLISHED_FLAG_REQUIRED",
          message: "published must be provided as a boolean value.",
        });
      }

      const product = await findSellerScopedProductDetail(storeId, productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          code: "SELLER_PRODUCT_NOT_FOUND",
          message: "Product not found for this seller store.",
        });
      }

      const beforeSnapshot = product?.get?.({ plain: true }) ?? product;

      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        getAttr(product, "sellerSubmissionStatus")
      );

      if (currentSubmissionStatus === "submitted") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_REVIEW_LOCKED",
          message:
            "This product is currently in admin review, so publish visibility cannot change yet.",
        });
      }

      if (currentSubmissionStatus === "needs_revision") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_REVIEW_LOCKED",
          message:
            "This product needs seller revisions first. Update the draft and resubmit before changing publish visibility.",
        });
      }

      if (nextPublished) {
        const readiness = resolveSellerPublishReadiness(product);

        if (!readiness.isReady) {
          return res.status(409).json({
            success: false,
            code: "SELLER_PRODUCT_PUBLISH_NOT_READY",
            message: readiness.blockers[0]?.message || "Product is not ready to publish.",
            data: {
              blockers: readiness.blockers,
              requiredState: "active + published",
            },
          });
        }

        await (product as any).update({
          status: "active",
          isPublished: true,
          ...buildSellerSubmissionResetPatch(),
        });
      } else {
        await (product as any).update({
          isPublished: false,
          ...buildSellerSubmissionResetPatch(),
        });
      }

      const detail = await findSellerScopedProductDetail(storeId, productId);
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      await logProductActivity({
        storeId,
        entityId: productId,
        action: nextPublished
          ? PRODUCT_ACTIVITY_LOG_ACTIONS.PUBLISHED
          : PRODUCT_ACTIVITY_LOG_ACTIONS.UNPUBLISHED,
        actorType: "seller",
        actorId: actorUserId,
        before: beforeSnapshot,
        after: detail || product,
        metadata: {
          source: "manual",
          lane: "seller",
        },
      });

      return res.json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess, storeContext),
          contract: buildCatalogReadContract(),
        },
      });
    } catch (error) {
      console.error("[seller/products/published] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update seller product visibility.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/products/:productId/submit-review",
  requireSellerStoreAccess(["PRODUCT_EDIT"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const productId = Number(req.params.productId);
      const actorUserId = Number((req as any).user?.id || 0);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_ID",
          message: "Invalid product id.",
        });
      }

      const product = await Product.findOne({
        where: {
          id: productId,
          storeId,
        },
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          code: "SELLER_PRODUCT_NOT_FOUND",
          message: "Product not found for this seller store.",
        });
      }

      const currentStatus = normalizeProductStatus(getAttr(product, "status"));
      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        getAttr(product, "sellerSubmissionStatus")
      );

      if (currentStatus !== "draft") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_SUBMISSION_DRAFT_REQUIRED",
          message: "Only draft products can be submitted for review.",
        });
      }

      if (currentSubmissionStatus === "submitted") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_ALREADY_SUBMITTED",
          message: "This seller draft is already submitted for review.",
        });
      }

      const beforeSnapshot = product.get?.({ plain: true }) ?? product;

      await product.update({
        sellerSubmissionStatus: "submitted",
        sellerSubmittedAt: new Date(),
        sellerSubmittedByUserId: actorUserId > 0 ? actorUserId : null,
        sellerRevisionRequestedAt: null,
        sellerRevisionRequestedByUserId: null,
        sellerRevisionNote: null,
      } as any);

      const detail = await findSellerScopedProductDetail(storeId, productId);
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      await logProductActivity({
        storeId,
        entityId: productId,
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.SUBMITTED_FOR_REVIEW,
        actorType: "seller",
        actorId: actorUserId,
        before: beforeSnapshot,
        after: detail || product,
        metadata: {
          source: "manual",
          lane: "seller",
        },
      });

      return res.json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess, storeContext),
          contract: buildCatalogReadContract(),
        },
      });
    } catch (error) {
      console.error("[seller/products/submit-review] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to submit seller product draft for review.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/products/:productId/duplicate",
  requireSellerStoreAccess(["PRODUCT_CREATE"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const productId = Number(req.params.productId);
      const actorUserId = Number((req as any).user?.id || 0);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_ID",
          message: "Invalid product id.",
        });
      }

      const sourceProduct = await findSellerScopedProductDetail(storeId, productId);

      if (!sourceProduct) {
        return res.status(404).json({
          success: false,
          code: "SELLER_PRODUCT_NOT_FOUND",
          message: "Product not found for this seller store.",
        });
      }

      const sourcePlain: any = sourceProduct.get
        ? sourceProduct.get({ plain: true })
        : sourceProduct;
      const sourceCategoryIds = Array.isArray(sourcePlain?.categories)
        ? sourcePlain.categories
            .map((category: any) => parseOptionalPositiveId(category?.id))
            .filter((value: number | null) => value !== null)
        : [];
      const defaultCategoryId =
        parseOptionalPositiveId(sourcePlain?.defaultCategoryId) ??
        parseOptionalPositiveId(sourcePlain?.categoryId);
      const nextCategoryIds =
        sourceCategoryIds.length > 0
          ? sourceCategoryIds
          : defaultCategoryId
            ? [defaultCategoryId]
            : [];
      const nextDefaultCategoryId =
        defaultCategoryId && nextCategoryIds.includes(defaultCategoryId)
          ? defaultCategoryId
          : nextCategoryIds[0] ?? null;
      const nextSlug = await resolveUniqueProductSlug(
        `${normalizeString(sourcePlain?.slug || sourcePlain?.name || `product-${productId}`)}-copy`
      );
      const nextSku = await resolveUniqueDuplicateSku(sourcePlain?.sku, productId);
      const imagePaths = normalizeStoredImagePathList(sourcePlain?.imagePaths);
      const promoImagePath =
        normalizeProductImageUrl(sourcePlain?.promoImagePath) || imagePaths[0] || null;
      const duplicateOwnerId =
        actorUserId > 0 ? actorUserId : toNumber(sourcePlain?.userId, 0) || 0;

      const duplicated = await sequelize.transaction(async (transaction) => {
        const created = await Product.create(
          {
            name: normalizeDuplicateName(sourcePlain?.name),
            slug: nextSlug,
            sku: nextSku,
            barcode: null,
            gtin: null,
            price: toNumber(sourcePlain?.price, 0),
            salePrice:
              sourcePlain?.salePrice === null || typeof sourcePlain?.salePrice === "undefined"
                ? null
                : toNumber(sourcePlain?.salePrice, 0),
            stock: toNumber(sourcePlain?.stock, 0),
            userId: duplicateOwnerId,
            storeId,
            categoryId: nextDefaultCategoryId,
            defaultCategoryId: nextDefaultCategoryId,
            status: "draft",
            isPublished: false,
            sellerSubmissionStatus: "none",
            sellerSubmittedAt: null,
            sellerSubmittedByUserId: null,
            sellerRevisionRequestedAt: null,
            sellerRevisionRequestedByUserId: null,
            sellerRevisionNote: null,
            description: sourcePlain?.description ?? null,
            promoImagePath,
            imagePaths,
            videoPath: normalizeProductImageUrl(sourcePlain?.videoPath) || null,
            tags: sourcePlain?.tags ?? [],
            weight:
              sourcePlain?.weight === null || typeof sourcePlain?.weight === "undefined"
                ? null
                : toNumber(sourcePlain?.weight, 0),
            notes: sourcePlain?.notes ?? null,
            parentSku: sourcePlain?.parentSku ?? null,
            condition: sourcePlain?.condition ?? null,
            length:
              sourcePlain?.length === null || typeof sourcePlain?.length === "undefined"
                ? null
                : toNumber(sourcePlain?.length, 0),
            width:
              sourcePlain?.width === null || typeof sourcePlain?.width === "undefined"
                ? null
                : toNumber(sourcePlain?.width, 0),
            height:
              sourcePlain?.height === null || typeof sourcePlain?.height === "undefined"
                ? null
                : toNumber(sourcePlain?.height, 0),
            dangerousProduct: Boolean(sourcePlain?.dangerousProduct),
            preOrder: Boolean(sourcePlain?.preOrder),
            preorderDays:
              sourcePlain?.preorderDays === null ||
              typeof sourcePlain?.preorderDays === "undefined"
                ? null
                : toNumber(sourcePlain?.preorderDays, 0),
            youtubeLink: sourcePlain?.youtubeLink ?? null,
            seo: sourcePlain?.seo ?? null,
            variations:
              sourcePlain?.variations === null || typeof sourcePlain?.variations === "undefined"
                ? null
                : sanitizeDuplicateStructuredValue(sourcePlain.variations),
            wholesale:
              sourcePlain?.wholesale === null || typeof sourcePlain?.wholesale === "undefined"
                ? null
                : sanitizeDuplicateStructuredValue(sourcePlain.wholesale),
          } as any,
          { transaction }
        );

        if (nextCategoryIds.length > 0) {
          await syncProductCategoryAssignments(
            Number((created as any).id),
            nextCategoryIds,
            transaction
          );
        }

        return Product.findByPk(Number((created as any).id), {
          transaction,
        });
      });

      const detail = await findSellerScopedProductDetail(
        storeId,
        Number((duplicated as any)?.id || 0)
      );
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      await logProductActivity({
        storeId,
        entityId: Number((duplicated as any)?.id || 0),
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.DUPLICATED,
        actorType: "seller",
        actorId: actorUserId,
        after: detail || duplicated,
        metadata: {
          source: "duplicate",
          lane: "seller",
          sourceProductId: productId,
          sourceProductName: normalizeString(sourcePlain?.name) || null,
        },
      });

      return res.status(201).json({
        success: true,
        data: {
          ...serializeProductDetail(detail || duplicated, sellerAccess, storeContext),
          contract: buildCatalogReadContract(),
        },
      });
    } catch (error) {
      console.error("[seller/products/duplicate] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to duplicate seller product.",
      });
    }
  }
);

router.delete(
  "/stores/:storeId/products/:productId",
  requireSellerStoreAccess(["PRODUCT_ARCHIVE"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const productId = Number(req.params.productId);
      const actorUserId = Number((req as any).user?.id || 0);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          code: "INVALID_PRODUCT_ID",
          message: "Invalid product id.",
        });
      }

      const product = await findSellerScopedProductDetail(storeId, productId);

      if (!product) {
        const existingProduct = await Product.findByPk(productId, {
          attributes: ["id", "storeId"],
        });

        if (existingProduct) {
          return res.status(404).json({
            success: false,
            code: "SELLER_PRODUCT_NOT_FOUND",
            message: "Product not found for this seller store.",
          });
        }

        return res.json({
          success: true,
          data: {
            id: productId,
            deleted: true,
            alreadyDeleted: true,
            archived: false,
            message: "Product was already removed from this seller store.",
          },
        });
      }

      const currentSubmissionStatus = normalizeSellerSubmissionStatus(
        getAttr(product, "sellerSubmissionStatus")
      );
      const beforeSnapshot = product?.get?.({ plain: true }) ?? product;

      if (currentSubmissionStatus !== "none") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_DELETE_REVIEW_LOCKED",
          message:
            "This product is currently in the seller review lane. Finish the review workflow before deleting or archiving it.",
        });
      }

      const isPublished = Boolean(getAttr(product, "isPublished"));
      const referencedIds = await resolveReferencedSellerProductIds([productId]);
      const hasHistory = referencedIds.includes(productId);

      if (hasHistory || isPublished) {
        const archiveResult = await archiveSellerProductsSafely([productId]);
        const detail = await findSellerScopedProductDetail(storeId, productId);
        const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
        await logProductActivity({
          storeId,
          entityId: productId,
          action: PRODUCT_ACTIVITY_LOG_ACTIONS.ARCHIVED,
          actorType: "seller",
          actorId: actorUserId,
          before: beforeSnapshot,
          after: detail || product,
          metadata: {
            source: "manual",
            lane: "seller",
            archiveReason: hasHistory ? "ORDER_OR_REVIEW_HISTORY" : "PUBLISHED_PRODUCT",
          },
        });

        return res.json({
          success: true,
          data: {
            id: productId,
            deleted: false,
            archived: archiveResult.affected > 0,
            archivedIds: archiveResult.archivedIds,
            archiveReason: hasHistory ? "ORDER_OR_REVIEW_HISTORY" : "PUBLISHED_PRODUCT",
            message: hasHistory
              ? "This product has order, review, or suborder history, so it was archived instead of deleted."
              : "Published seller products are archived instead of being hard deleted.",
            product:
              detail &&
              serializeProductDetail(detail, sellerAccess, storeContext),
            contract: buildCatalogReadContract(),
          },
        });
      }

      const deletion = await deleteSellerProductsSafely([productId]);

      if (deletion.blockedIds.includes(productId)) {
        const archiveResult = await archiveSellerProductsSafely([productId]);
        const detail = await findSellerScopedProductDetail(storeId, productId);
        const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
        await logProductActivity({
          storeId,
          entityId: productId,
          action: PRODUCT_ACTIVITY_LOG_ACTIONS.ARCHIVED,
          actorType: "seller",
          actorId: actorUserId,
          before: beforeSnapshot,
          after: detail || product,
          metadata: {
            source: "manual",
            lane: "seller",
            archiveReason: "ORDER_OR_REVIEW_HISTORY",
          },
        });

        return res.json({
          success: true,
          data: {
            id: productId,
            deleted: false,
            archived: archiveResult.affected > 0,
            archivedIds: archiveResult.archivedIds,
            archiveReason: "ORDER_OR_REVIEW_HISTORY",
            message:
              "This product has order, review, or suborder history, so it was archived instead of deleted.",
            product:
              detail &&
              serializeProductDetail(detail, sellerAccess, storeContext),
            contract: buildCatalogReadContract(),
          },
        });
      }

      if (deletion.affected <= 0) {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_DELETE_FAILED",
          message: "Delete failed. Please try again.",
        });
      }

      await logProductActivity({
        storeId,
        entityId: productId,
        action: PRODUCT_ACTIVITY_LOG_ACTIONS.DELETED,
        actorType: "seller",
        actorId: actorUserId,
        before: beforeSnapshot,
        after: null,
        metadata: {
          source: "manual",
          lane: "seller",
        },
      });

      return res.json({
        success: true,
        data: {
          id: productId,
          deleted: true,
          archived: false,
          message: "Product deleted successfully.",
        },
      });
    } catch (error) {
      console.error("[seller/products/delete] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to delete seller product.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/products/import",
  requireSellerStoreAccess(["PRODUCT_CREATE"]),
  upload.single("file"),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const actorUserId = Number((req as any).user?.id || 0);
      const items = parseSellerImportPayload(req.file);

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          code: "SELLER_PRODUCT_IMPORT_EMPTY",
          message: "Import file must contain at least one product row.",
        });
      }

      let created = 0;
      let failed = 0;
      const errors: Array<{ row: number; slug: string | null; message: string }> = [];

      for (let index = 0; index < items.length; index += 1) {
        const rawRow = items[index];

        try {
          const row = normalizeSellerImportRow(rawRow);

          if (row.storeId && row.storeId !== storeId) {
            throw new Error(
              `Row storeId ${row.storeId} does not match the active seller store ${storeId}.`
            );
          }

          if (!row.name) {
            throw new Error("Imported seller products require `title` or `name`.");
          }

          if (typeof row.price === "undefined") {
            throw new Error("Imported seller products require `price`.");
          }

          const resolvedCategoryId = await resolveSellerImportCategoryId({
            categoryId: row.categoryId,
            categoryCode: row.categoryCode,
            categoryName: row.categoryName,
          });

          if (!resolvedCategoryId) {
            throw new Error(
              "Imported seller products require `categoryId`, `categoryCode`, `categoryName`, or `category`."
            );
          }

          const payload = await parseSellerProductDraftPayload({
            name: row.name,
            slug: row.slug || row.name,
            sku: row.sku,
            barcode: row.barcode,
            description: row.description,
            price: row.price,
            salePrice: row.salePrice,
            stock: row.stock,
            categoryIds: [resolvedCategoryId],
            defaultCategoryId: resolvedCategoryId,
            imageUrls: row.imageUrls,
            tags: row.tags,
          });

          const nextSlug = await resolveUniqueProductSlug(payload.slug || payload.name);
          const nextSku = await resolveUniqueImportedSku(payload.sku);

          const createdProduct = await sequelize.transaction(async (transaction) => {
            const createdProduct = await Product.create(
              {
                name: payload.name,
                slug: nextSlug,
                description: payload.description || undefined,
                sku: nextSku,
                barcode: payload.barcode,
                status: "draft",
                isPublished: false,
                sellerSubmissionStatus: "none",
                sellerSubmittedAt: null,
                sellerSubmittedByUserId: null,
                sellerRevisionRequestedAt: null,
                sellerRevisionRequestedByUserId: null,
                sellerRevisionNote: null,
                price: payload.price ?? 0,
                salePrice:
                  typeof payload.salePrice === "undefined" ? null : payload.salePrice,
                stock: payload.stock ?? 0,
                categoryId: payload.categoryId,
                defaultCategoryId: payload.defaultCategoryId,
                promoImagePath: Array.isArray(payload.imageUrls)
                  ? payload.imageUrls[0] || null
                  : null,
                imagePaths: Array.isArray(payload.imageUrls) ? payload.imageUrls : [],
                tags: Array.isArray(payload.tags) ? payload.tags : undefined,
                userId: actorUserId,
                storeId,
              } as any,
              { transaction }
            );

            if (payload.categoryIds.length > 0) {
              await syncProductCategoryAssignments(
                Number((createdProduct as any).id),
                payload.categoryIds,
                transaction
              );
            }

            return Product.findByPk(Number((createdProduct as any).id), {
              transaction,
            });
          });

          await logProductActivity({
            storeId,
            entityId: Number((createdProduct as any)?.id || 0),
            action: PRODUCT_ACTIVITY_LOG_ACTIONS.IMPORTED,
            actorType: "seller",
            actorId: actorUserId,
            after: createdProduct,
            metadata: {
              source: "import",
              importFormat: String(req.file?.originalname || "").toLowerCase().endsWith(".json")
                ? "json"
                : "csv",
              lane: "seller",
            },
          });
          created += 1;
        } catch (error: any) {
          failed += 1;
          errors.push({
            row: index + 1,
            slug:
              nullableString(rawRow?.slug ?? rawRow?.name ?? rawRow?.title ?? rawRow?.productName) ||
              null,
            message: error?.message || "Import row failed.",
          });
        }
      }

      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);

      return res.json({
        success: true,
        data: {
          totalRows: items.length,
          created,
          failed,
          errors,
          governance: buildCatalogGovernance(sellerAccess),
          storefrontVisibility: {
            storeStatus: storeContext.status,
            operational: storeContext.isOperational,
          },
        },
      });
    } catch (error) {
      const status = Number((error as any)?.status || 500);
      if (status >= 400 && status < 500) {
        return res.status(status).json({
          success: false,
          code: (error as any)?.code || "SELLER_PRODUCT_IMPORT_FAILED",
          message: (error as any)?.message || "Failed to import seller products.",
        });
      }

      console.error("[seller/products/import] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to import seller products.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/products/bulk-submission",
  requireSellerStoreAccess(["PRODUCT_EDIT"]),
  async (req, res) => {
    try {
      const storeId = Number(req.params.storeId);
      const actorUserId = Number((req as any).user?.id || 0);
      const action = normalizeSellerBulkAction(req.body?.action);
      const ids = normalizePositiveIdList(req.body?.ids);

      if (!action) {
        return res.status(400).json({
          success: false,
          code: "SELLER_PRODUCT_BULK_ACTION_INVALID",
          message: "Seller bulk action is invalid.",
        });
      }

      if (ids.length === 0) {
        return res.status(400).json({
          success: false,
          code: "SELLER_PRODUCT_BULK_IDS_REQUIRED",
          message: "Select at least one seller product before running a bulk action.",
        });
      }

      const rows = await Product.findAll({
        where: {
          storeId,
          id: {
            [Op.in]: ids,
          },
        } as any,
        attributes: [
          "id",
          "storeId",
          "name",
          "status",
          "sellerSubmissionStatus",
        ],
      });
      const productById = new Map(
        rows.map((product: any) => [toNumber(getAttr(product, "id"), 0), product])
      );
      const results: any[] = [];

      for (const id of ids) {
        const product = productById.get(id);

        if (!product) {
          results.push({
            id,
            status: "failed",
            code: "SELLER_PRODUCT_NOT_FOUND",
            message: "Product not found for this seller store.",
          });
          continue;
        }

        const validation = validateSellerBulkSubmissionAction(product, action);
        if (!validation.ok) {
          results.push({
            id,
            name: String(getAttr(product, "name") || ""),
            status: "failed",
            code: validation.code,
            message: validation.message,
          });
          continue;
        }

        const beforeSnapshot = product.get?.({ plain: true }) ?? product;
        await product.update(buildSellerBulkSubmissionPatch(actorUserId) as any);
        await logProductActivity({
          storeId,
          entityId: id,
          action: PRODUCT_ACTIVITY_LOG_ACTIONS.SUBMITTED_FOR_REVIEW,
          actorType: "seller",
          actorId: actorUserId,
          before: beforeSnapshot,
          after: product,
          metadata: {
            source: action === "resubmit_review" ? "resubmit" : "bulk_submit",
            lane: "seller",
          },
        });

        results.push({
          id,
          name: String(getAttr(product, "name") || ""),
          status: "success",
          code:
            action === "resubmit_review"
              ? "SELLER_PRODUCT_RESUBMITTED"
              : "SELLER_PRODUCT_SUBMITTED",
          message:
            action === "resubmit_review"
              ? "Revision draft resubmitted for admin review."
              : "Draft submitted for admin review.",
          submissionStatus: "submitted",
        });
      }

      const successCount = results.filter((entry) => entry.status === "success").length;
      const failureCount = results.length - successCount;

      return res.json({
        success: true,
        data: {
          action,
          actionLabel:
            action === "resubmit_review"
              ? "Resubmit selected revisions"
              : "Submit selected drafts",
          summary: {
            requested: ids.length,
            successCount,
            failureCount,
          },
          results,
        },
      });
    } catch (error) {
      console.error("[seller/products/bulk-submission] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to run seller bulk submission.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/products/export",
  requireSellerStoreAccess(["PRODUCT_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      const idsInput = req.body?.ids;
      const hasSelectedIds = Array.isArray(idsInput);
      const ids = normalizePositiveIdList(idsInput, 500);

      if (hasSelectedIds && ids.length === 0) {
        return res.status(400).json({
          success: false,
          code: "SELLER_PRODUCT_EXPORT_IDS_REQUIRED",
          message: "Select at least one seller product before exporting a selection.",
        });
      }

      const filters = parseSellerProductsFilterInput(req.body?.filters);
      const format = normalizeSellerExportFormat(req.body?.format);
      const where = await buildSellerProductsWhere({
        storeId,
        storeStatus: storeContext.status,
        storefrontOperational: storeContext.isOperational,
        ...filters,
        ids,
      });
      const rows = await fetchSellerProductListRows(where, {
        sort: filters.sort,
      });

      if (hasSelectedIds) {
        const foundIds = new Set(
          rows.map((product: any) => toNumber(getAttr(product, "id"), 0)).filter((id) => id > 0)
        );
        const missingIds = ids.filter((id) => !foundIds.has(id));

        if (missingIds.length > 0) {
          return res.status(404).json({
            success: false,
            code: "SELLER_PRODUCT_EXPORT_SCOPE_MISMATCH",
            message: "One or more selected products do not belong to this seller store.",
            missingIds,
          });
        }
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const scopeLabel = hasSelectedIds ? "selected" : "filtered";
      if (format === "json") {
        const payload = {
          format: "seller-products.v1",
          exportedAt: new Date().toISOString(),
          total: rows.length,
          filters: {
            keyword: filters.keyword || null,
            categoryIds: filters.categoryIds,
            status: filters.status || null,
            published: typeof filters.published === "boolean" ? filters.published : null,
            submissionStatus: filters.submissionStatus || null,
            visibilityState: filters.visibilityState || null,
            sort: filters.sort || null,
          },
          items: rows.map((product) =>
            toSellerProductExportItem(product, sellerAccess, storeContext)
          ),
        };

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="seller-products-${storeId}-${scopeLabel}-${timestamp}.json"`
        );
        return res.status(200).send(JSON.stringify(payload, null, 2));
      }

      const csv = `\uFEFF${buildSellerProductsCsv(rows, sellerAccess, storeContext)}`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="seller-products-${storeId}-${scopeLabel}-${timestamp}.csv"`
      );

      return res.status(200).send(csv);
    } catch (error) {
      console.error("[seller/products/export] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to export seller products.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/products",
  requireSellerStoreAccess(["PRODUCT_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      const page = parsePositiveInt(req.query.page, 1, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 20, 1, 50);
      const offset = (page - 1) * limit;
      const keyword = normalizeString(req.query.keyword);
      const categoryIds = normalizePositiveIdFilterList(req.query.categoryIds, 50);
      const status = normalizeString(req.query.status).toLowerCase();
      const published = parseBooleanFilter(req.query.published);
      const submissionStatus = normalizeSellerSubmissionFilter(req.query.submissionStatus);
      const visibilityState = normalizeVisibilityStateFilter(req.query.visibilityState);
      const sort = normalizeSellerSort(req.query.sort);
      const where = await buildSellerProductsWhere({
        storeId,
        storeStatus: storeContext.status,
        storefrontOperational: storeContext.isOperational,
        keyword,
        categoryIds,
        status,
        published,
        submissionStatus,
        visibilityState,
      });

      const [result, summary] = await Promise.all([
        Product.findAndCountAll({
          where,
          attributes: [
            "id",
            "storeId",
            "name",
            "slug",
            "sku",
            "status",
            "isPublished",
            "sellerSubmissionStatus",
            "sellerSubmittedAt",
            "sellerSubmittedByUserId",
            "sellerRevisionRequestedAt",
            "sellerRevisionRequestedByUserId",
            "sellerRevisionNote",
            "price",
            "salePrice",
            "stock",
            "promoImagePath",
            "imagePaths",
            "createdAt",
            "updatedAt",
          ],
          include: [
            {
              model: Category,
              as: "defaultCategory",
              attributes: ["id", "name", "code"],
              required: false,
            },
            {
              model: Category,
              as: "category",
              attributes: ["id", "name", "code"],
              required: false,
            },
          ],
          order: buildSellerProductsOrder(sort),
          limit,
          offset,
          distinct: true,
        }),
        buildSellerProductSummary(storeId, storeContext),
      ]);

      return res.json({
        success: true,
        data: {
          items: result.rows.map((product) =>
            serializeProductListItem(product, sellerAccess, storeContext)
          ),
          contract: buildCatalogReadContract(),
          governance: buildCatalogGovernance(sellerAccess),
          summary,
          filters: {
            keyword,
            categoryIds,
            status: allowedStatuses.has(status) ? status : "",
            published,
            submissionStatus,
            visibilityState,
            sort,
          },
          pagination: {
            page,
            limit,
            total: result.count,
          },
        },
      });
    } catch (error) {
      console.error("[seller/products/list] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller products.",
      });
    }
  }
);

router.get(
  "/stores/:storeId/products/:productId",
  requireSellerStoreAccess(["PRODUCT_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const storeContext = await loadSellerStorefrontVisibilityContext(storeId);
      const productId = Number(req.params.productId);

      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product id.",
        });
      }

      const product = await findSellerScopedProductDetail(storeId, productId);

      if (!product) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      return res.json({
        success: true,
        data: {
          ...serializeProductDetail(product, sellerAccess, storeContext),
          contract: buildCatalogReadContract(),
        },
      });
    } catch (error) {
      console.error("[seller/products/detail] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller product detail.",
      });
    }
  }
);

export default router;
