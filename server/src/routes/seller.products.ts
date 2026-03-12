import { Op } from "sequelize";
import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Category, Product, ProductCategory } from "../models/index.js";
import { sellerHasPermission } from "../services/seller/resolveSellerAccess.js";

const router = Router();

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
]);
const allowedVisibilityStates = new Set([
  "internal_only",
  "storefront_visible",
  "published_blocked",
]);
const allowedSellerBulkActions = new Set(["submit_review", "resubmit_review"]);

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

const buildProductSlugBase = (value: unknown) => {
  const normalized =
    normalizeString(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "product";
  return normalized.slice(0, 180);
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

const SELLER_AUTHORING_EDITABLE_FIELDS = [
  "name",
  "description",
  "sku",
  "categoryIds",
  "defaultCategoryId",
  "price",
  "salePrice",
  "stock",
  "imageUrls",
] as const;
const SELLER_AUTHORING_DEFERRED_FIELDS = [
  "categories",
  "videoPath",
  "tags",
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
  "barcode",
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
  categoryIds: number[]
) => {
  const existingRows = await ProductCategory.findAll({
    where: { productId } as any,
    attributes: ["categoryId"],
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
    });
  }

  if (idsToCreate.length > 0) {
    await ProductCategory.bulkCreate(
      idsToCreate.map((categoryId) => ({ productId, categoryId })) as any,
      { ignoreDuplicates: true }
    );
  }
};

const buildAuthoringPermissions = (sellerAccess: any = null) => {
  const permissionKeys = Array.isArray(sellerAccess?.permissionKeys)
    ? sellerAccess.permissionKeys
    : [];

  return {
    canCreateDraft: sellerHasPermission(permissionKeys, "PRODUCT_CREATE"),
    canEditDrafts: sellerHasPermission(permissionKeys, "PRODUCT_EDIT"),
    canSubmitDrafts: sellerHasPermission(permissionKeys, "PRODUCT_EDIT"),
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
    sellerCanPublish: false,
    requiresSellerChanges: submissionStatus === "needs_revision",
    note:
      submissionStatus === "submitted"
        ? "This product draft has been handed off for review. Seller editing is locked until a later review or revision flow is opened."
        : submissionStatus === "needs_revision"
          ? "Admin requested a revision for this draft. Seller editing is reopened for the current store so the product can be corrected and resubmitted."
        : hasConcreteProduct
          ? "Seller may submit a store-scoped draft for review, but publish authority remains admin-owned."
          : "Submission action becomes available only after a concrete draft exists and seller governance allows the handoff.",
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
      label: "Waiting for Admin Review",
      description:
        "Admin is the next actor. Seller editing and resubmission stay locked until an admin requests revisions or publishes the final outcome.",
    };
  }

  if (submissionStatus === "needs_revision") {
    return {
      code: canEditDraft ? "CONTINUE_REVISION" : "REVISION_LOCKED",
      label: canEditDraft ? "Continue Revision" : "Revision Locked",
      description: canResubmit
        ? "Update the requested fields, then resubmit this draft for admin review."
        : "Admin requested changes for this draft before it can move forward again.",
    };
  }

  if (productStatus === "draft" && canSubmit) {
    return {
      code: "SUBMIT_REVIEW",
      label: "Submit for Review",
      description:
        "This draft is still seller-owned. Finish the required changes, then submit it to the admin review lane.",
    };
  }

  if (productStatus === "draft" && canEditDraft) {
    return {
      code: "EDIT_DRAFT",
      label: "Edit Draft",
      description:
        "This draft is still inside seller authoring. Complete the remaining fields before submitting it for review.",
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
    label: "Review Status",
    description:
      "No seller submission action is currently available. Review the current lifecycle and storefront visibility state.",
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

  if (!permissions.canEditDrafts) {
    return {
      canEditDraft: false,
      editBlockedReason: "PRODUCT_EDIT_PERMISSION_REQUIRED",
      allowedStatuses: ["draft"],
    };
  }

  if (normalizeSellerSubmissionStatus(submissionStatus) === "submitted") {
    return {
      canEditDraft: false,
      editBlockedReason: "PRODUCT_SUBMISSION_PENDING_REVIEW",
      allowedStatuses: ["draft"],
    };
  }

  if (status !== "draft") {
    return {
      canEditDraft: false,
      editBlockedReason: "PRODUCT_STATUS_NOT_DRAFT",
      allowedStatuses: ["draft"],
    };
  }

  return {
    canEditDraft: true,
    editBlockedReason: null,
    allowedStatuses: ["draft"],
  };
};

const buildFieldGovernance = () => ({
  sellerEditableNow: [...SELLER_AUTHORING_EDITABLE_FIELDS],
  sellerReadOnly: [
    "slug",
    "promoImagePath",
    "imagePaths",
    "videoPath",
    "tags",
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
    "barcode",
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
  const categorySelection = await resolveSellerCategorySelection(body);
  const price = normalizeOptionalMoney(body?.price);
  const salePrice = normalizeOptionalMoney(body?.salePrice);
  const stock = normalizeOptionalInteger(body?.stock);
  const hasImageUrls = Array.isArray(body?.imageUrls);
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
    categoryIds: categorySelection.categoryIds,
    defaultCategoryId: categorySelection.defaultCategoryId,
    categoryId: categorySelection.categoryId,
    price: typeof price === "number" ? price : undefined,
    salePrice:
      typeof salePrice === "number" ? (salePrice > 0 ? salePrice : null) : undefined,
    stock: typeof stock === "number" ? stock : undefined,
    imageUrls,
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
    status: "Product.status",
    publishFlag: "Product.isPublished",
    storefrontVisibility: "Product.isPublished === true && Product.status === active",
  },
  supportedStatuses: ["active", "inactive", "draft"],
  notes: [
    "Seller catalog stays store-scoped through Product.storeId.",
    "Current public storefront queries only gate product visibility by publish flag and active status.",
    "Stock, pre-order, category publish state, and store status are not currently used as storefront visibility gates in product queries.",
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

const serializeProductVisibility = (isPublished: boolean, status: string) => {
  const storefrontVisible = isPublished && status === "active";
  const blockingSignals = [];

  if (!isPublished) {
    blockingSignals.push("PUBLISH_OFF");
  }
  if (status !== "active") {
    blockingSignals.push("STATUS_NOT_ACTIVE");
  }

  const stateCode = !isPublished
    ? "INTERNAL_ONLY"
    : storefrontVisible
      ? "STOREFRONT_VISIBLE"
      : "PUBLISHED_BLOCKED";

  return {
    isPublished,
    storefrontVisible,
    stateCode,
    label: isPublished ? "Published" : "Private",
    publishLabel: isPublished ? "Published" : "Private",
    sellerLabel: !isPublished
      ? "Private to seller and admin"
      : storefrontVisible
        ? "Visible in storefront"
        : "Published but blocked",
    storefrontLabel: storefrontVisible ? "Visible in storefront" : "Hidden from storefront",
    storefrontReason: !isPublished
      ? "Public storefront queries exclude this product because the publish flag is off."
      : storefrontVisible
        ? "Public storefront queries include this product because publish is on and status is active."
        : "Publish is on, but public storefront queries still exclude this product until status becomes active.",
    sellerHint: !isPublished
      ? "Seller can still review this product here, but customers cannot see it yet."
      : storefrontVisible
        ? "Seller and customer views are aligned for visibility."
        : "Seller can review this product here, but customers will not see it until status becomes active.",
    blockingSignals,
    reasonCode: !isPublished
      ? "UNPUBLISHED"
      : storefrontVisible
        ? "STOREFRONT_VISIBLE"
        : "STATUS_NOT_ACTIVE",
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
      "Current storefront product queries do not hide products based on stock or pre-order flags.",
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
    mode: "DRAFT_FIRST_MVP",
    roleCode: sellerAccess?.roleCode ? String(sellerAccess.roleCode) : null,
    canCreate: permissions.canCreateDraft,
    canEdit: permissions.canEditDrafts,
    canDelete: false,
    canPublish: false,
    canManagePricing: true,
    canManageInventory: true,
    canManageMedia: true,
    sourceOfTruth: "ADMIN_PRODUCT_WORKSPACE",
    note:
      "Seller product authoring stays draft-first. Seller workspace may now fill core draft fields such as categories, pricing, stock, and a minimal product image set, while publish and deeper admin governance stay outside this lane.",
    authoring: {
      phase: "DRAFT_FIRST_PHASE_2",
      phaseLabel: "Draft-first Phase 2",
      writeLaneActive: true,
      recommendedPhase1: "DRAFT_FIRST_FIELD_EXPANSION",
      legacySellerRoutesPresent: true,
      legacySellerRoutesMounted: false,
      canCreateDraft: permissions.canCreateDraft,
      canEditDraft: authoringState.canEditDraft,
      editBlockedReason: authoringState.editBlockedReason,
      allowedWriteStatuses: authoringState.allowedStatuses,
      note:
        "Seller workspace may create and edit draft products with seller-safe core fields: name, description, SKU, categories, pricing, stock, and a minimal image set. Publish controls remain outside the active seller write lane.",
    },
    submissionGovernance: buildSellerSubmissionGovernance(sellerAccess, options),
    statusGovernance: {
      productStatuses: ["draft", "active", "inactive"],
      publishFlag: "admin-owned",
      sellerStateTransitionsActive: false,
      note:
        "The repo currently exposes product status and publish state, but seller workspace does not yet own a write contract for those transitions.",
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

const serializeProductListItem = (product: any, sellerAccess: any = null) => {
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
  const visibility = serializeProductVisibility(isPublished, status);
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

const serializeProductDetail = (product: any, sellerAccess: any = null) => {
  const defaultCategory =
    product?.defaultCategory ?? product?.get?.("defaultCategory") ?? null;
  const primaryCategory = product?.category ?? product?.get?.("category") ?? null;
  const categories = Array.isArray(product?.categories)
    ? product.categories
    : Array.isArray(product?.get?.("categories"))
      ? product.get("categories")
      : [];
  const imagePaths = Array.isArray(getAttr(product, "imagePaths"))
    ? getAttr(product, "imagePaths").map((entry: unknown) => normalizeString(entry)).filter(Boolean)
    : [];
  const promoImageUrl = resolveProductPreviewImage(product);
  const price = toNumber(getAttr(product, "price"));
  const salePriceRaw = getAttr(product, "salePrice");
  const salePrice =
    salePriceRaw === null || typeof salePriceRaw === "undefined"
      ? null
      : toNumber(salePriceRaw, 0);
  const status = normalizeProductStatus(getAttr(product, "status"));
  const isPublished = Boolean(getAttr(product, "isPublished"));
  const visibility = serializeProductVisibility(isPublished, status);
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
      imageUrls: imagePaths,
      videoUrl: getAttr(product, "videoPath") ? String(getAttr(product, "videoPath")) : null,
      totalImages: imagePaths.length,
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

const buildSellerProductSummary = async (storeId: number) => {
  const baseWhere = { storeId } as any;

  const [
    totalProducts,
    drafts,
    submitted,
    needsRevision,
    storefrontVisible,
    publishedBlocked,
    internalOnly,
  ] = await Promise.all([
    Product.count({ where: baseWhere }),
    Product.count({ where: { ...baseWhere, status: "draft" } as any }),
    Product.count({
      where: { ...baseWhere, sellerSubmissionStatus: "submitted" } as any,
    }),
    Product.count({
      where: { ...baseWhere, sellerSubmissionStatus: "needs_revision" } as any,
    }),
    Product.count({
      where: { ...baseWhere, isPublished: true, status: "active" } as any,
    }),
    Product.count({
      where: {
        ...baseWhere,
        isPublished: true,
        status: { [Op.ne]: "active" },
      } as any,
    }),
    Product.count({ where: { ...baseWhere, isPublished: false } as any }),
  ]);

  return {
    totalProducts,
    drafts,
    submitted,
    needsRevision,
    storefrontVisible,
    publishedBlocked,
    internalOnly,
  };
};

const parseSellerProductsFilterInput = (source: any = {}) => ({
  keyword: normalizeString(source?.keyword),
  status: normalizeString(source?.status).toLowerCase(),
  published: parseBooleanFilter(source?.published),
  submissionStatus: normalizeSellerSubmissionFilter(source?.submissionStatus),
  visibilityState: normalizeVisibilityStateFilter(source?.visibilityState),
});

const buildSellerProductsWhere = (options: any = {}) => {
  const andConditions: any[] = [];
  const ids = Array.isArray(options?.ids) ? options.ids : [];

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
  } else if (allowedSellerSubmissionStatuses.has(options?.submissionStatus)) {
    andConditions.push({ sellerSubmissionStatus: options.submissionStatus });
  }

  if (options?.visibilityState === "internal_only") {
    andConditions.push({ isPublished: false });
  } else if (options?.visibilityState === "storefront_visible") {
    andConditions.push({ isPublished: true }, { status: "active" });
  } else if (options?.visibilityState === "published_blocked") {
    andConditions.push({ isPublished: true }, { status: { [Op.ne]: "active" } });
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
    order: [["updatedAt", "DESC"]],
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

const buildSellerProductsCsv = (products: any[], sellerAccess: any = null) => {
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
    const item = serializeProductListItem(product, sellerAccess);
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
          categoryIds: [],
          defaultCategoryId: null,
          price: 0,
          salePrice: null,
          stock: 0,
          imageUrls: [],
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
      const slug = await resolveUniqueProductSlug(payload.name);

      const product = await Product.create({
        name: payload.name,
        slug,
        description: payload.description || undefined,
        sku: payload.sku,
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
        userId: actorUserId,
        storeId,
      } as any);

      if (payload.categoryIds.length > 0) {
        await syncProductCategoryAssignments(Number((product as any).id), payload.categoryIds);
      }

      const detail = await findSellerScopedProductDetail(storeId, Number((product as any).id));

      return res.status(201).json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess),
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
      if (currentStatus !== "draft") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_DRAFT_REQUIRED",
          message: "Only draft products can be edited in seller authoring MVP.",
        });
      }

      if (currentSubmissionStatus === "submitted") {
        return res.status(409).json({
          success: false,
          code: "SELLER_PRODUCT_SUBMISSION_LOCKED",
          message:
            "This seller product is already marked as submitted for review and is locked for draft editing.",
        });
      }

      const nextSlug =
        normalizeString(getAttr(product, "name")) !== payload.name
          ? await resolveUniqueProductSlug(payload.name, productId)
          : normalizeString(getAttr(product, "slug"));

      await product.update({
        name: payload.name,
        slug: nextSlug,
        description: payload.description,
        sku: payload.sku,
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
      } as any);

      await syncProductCategoryAssignments(productId, payload.categoryIds);

      const detail = await findSellerScopedProductDetail(storeId, productId);

      return res.json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess),
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

      await product.update({
        sellerSubmissionStatus: "submitted",
        sellerSubmittedAt: new Date(),
        sellerSubmittedByUserId: actorUserId > 0 ? actorUserId : null,
        sellerRevisionRequestedAt: null,
        sellerRevisionRequestedByUserId: null,
        sellerRevisionNote: null,
      } as any);

      const detail = await findSellerScopedProductDetail(storeId, productId);

      return res.json({
        success: true,
        data: {
          ...serializeProductDetail(detail || product, sellerAccess),
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

        await product.update(buildSellerBulkSubmissionPatch(actorUserId) as any);

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
      const where = buildSellerProductsWhere({
        storeId,
        ...filters,
        ids,
      });
      const rows = await fetchSellerProductListRows(where);

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

      const csv = `\uFEFF${buildSellerProductsCsv(rows, sellerAccess)}`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const scopeLabel = hasSelectedIds ? "selected" : "filtered";

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
      const page = parsePositiveInt(req.query.page, 1, 1, 10_000);
      const limit = parsePositiveInt(req.query.limit, 20, 1, 50);
      const offset = (page - 1) * limit;
      const keyword = normalizeString(req.query.keyword);
      const status = normalizeString(req.query.status).toLowerCase();
      const published = parseBooleanFilter(req.query.published);
      const submissionStatus = normalizeSellerSubmissionFilter(req.query.submissionStatus);
      const visibilityState = normalizeVisibilityStateFilter(req.query.visibilityState);
      const andConditions: any[] = [];

      if (allowedStatuses.has(status)) {
        andConditions.push({ status });
      }

      if (published !== null) {
        andConditions.push({ isPublished: published });
      }

      if (submissionStatus === "review_queue") {
        andConditions.push({
          sellerSubmissionStatus: {
            [Op.in]: ["submitted", "needs_revision"],
          },
        });
      } else if (allowedSellerSubmissionStatuses.has(submissionStatus)) {
        andConditions.push({ sellerSubmissionStatus: submissionStatus });
      }

      if (visibilityState === "internal_only") {
        andConditions.push({ isPublished: false });
      } else if (visibilityState === "storefront_visible") {
        andConditions.push({ isPublished: true }, { status: "active" });
      } else if (visibilityState === "published_blocked") {
        andConditions.push({ isPublished: true }, { status: { [Op.ne]: "active" } });
      }

      if (keyword) {
        const likeKeyword = `%${keyword}%`;
        andConditions.push({
          [Op.or]: [
            { name: { [Op.like]: likeKeyword } },
            { slug: { [Op.like]: likeKeyword } },
            { sku: { [Op.like]: likeKeyword } },
          ],
        });
      }

      const where: any = {
        storeId,
        ...(andConditions.length > 0 ? { [Op.and]: andConditions } : {}),
      };

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
          order: [["updatedAt", "DESC"]],
          limit,
          offset,
          distinct: true,
        }),
        buildSellerProductSummary(storeId),
      ]);

      return res.json({
        success: true,
        data: {
          items: result.rows.map((product) => serializeProductListItem(product, sellerAccess)),
          contract: buildCatalogReadContract(),
          governance: buildCatalogGovernance(sellerAccess),
          summary,
          filters: {
            keyword,
            status: allowedStatuses.has(status) ? status : "",
            published,
            submissionStatus,
            visibilityState,
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
          ...serializeProductDetail(product, sellerAccess),
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
