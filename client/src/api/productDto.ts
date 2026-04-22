import { normalizeProductDisplayTags } from "../utils/productDisplay.js";

export type ProductFieldParityStatus =
  | "same"
  | "compatible"
  | "unsupported"
  | "forbidden";

export type ProductListItemDTO = {
  id: number;
  storeId: number;
  name: string;
  slug: string;
  sku: string | null;
  status: string;
  statusMeta: {
    code: string;
    label: string;
    storefrontEligible: boolean;
    operationalMeaning: string;
  };
  published: boolean;
  visibility: Record<string, any>;
  publishing: Record<string, any> | null;
  submission: Record<string, any> | null;
  authoring: Record<string, any> | null;
  storefrontVisibilityState: string | null;
  pricing: Record<string, any>;
  availability: Record<string, any>;
  inventory: Record<string, any>;
  ownership: Record<string, any> | null;
  category: Record<string, any> | null;
  mediaPreviewUrl: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  [key: string]: any;
};

export type ProductDetailDTO = ProductListItemDTO & {
  descriptions?: Record<string, any>;
  governance?: Record<string, any> | null;
  category: {
    primary: Record<string, any> | null;
    default: Record<string, any> | null;
    assigned: Array<Record<string, any>>;
  };
  media: {
    promoImageUrl: string | null;
    videoUrl: string | null;
    imageUrls: string[];
    totalImages: number;
    [key: string]: any;
  };
  attributes: Record<string, any>;
  variations?: Record<string, any>;
  wholesale?: Record<string, any>;
};

export type ProductWriteDTO = {
  name: string;
  description?: string | null;
  sku?: string | null;
  barcode?: string | null;
  slug?: string | null;
  categoryIds?: number[];
  defaultCategoryId?: number | null;
  price?: number;
  salePrice?: number | null;
  stock?: number;
  imageUrls?: string[];
  tags?: string[];
  status?: string | null;
  published?: boolean | null;
  seo?: unknown | null;
  variations?: unknown | null;
};

export const PRODUCT_WRITE_FIELD_PARITY = [
  {
    field: "name",
    admin: "same",
    seller: "same",
    notes: "Required for create on both lanes. Seller update still requires it today.",
  },
  {
    field: "description",
    admin: "same",
    seller: "same",
    notes: "Shared plain-text description field.",
  },
  {
    field: "sku",
    admin: "same",
    seller: "same",
    notes: "Shared optional identifier.",
  },
  {
    field: "barcode",
    admin: "same",
    seller: "same",
    notes: "Shared optional barcode field.",
  },
  {
    field: "slug",
    admin: "same",
    seller: "same",
    notes: "Both lanes accept slug and normalize it server-side.",
  },
  {
    field: "categoryIds",
    admin: "same",
    seller: "same",
    notes: "Shared multi-category selector.",
  },
  {
    field: "defaultCategoryId",
    admin: "same",
    seller: "same",
    notes: "Shared primary/default category pointer.",
  },
  {
    field: "price",
    admin: "same",
    seller: "same",
    notes: "Shared base price.",
  },
  {
    field: "salePrice",
    admin: "same",
    seller: "same",
    notes: "Shared discount price.",
  },
  {
    field: "stock",
    admin: "same",
    seller: "same",
    notes: "Shared inventory quantity.",
  },
  {
    field: "imageUrls",
    admin: "same",
    seller: "same",
    notes: "Shared gallery array. First image is primary.",
  },
  {
    field: "tags",
    admin: "same",
    seller: "same",
    notes: "Shared tag list.",
  },
  {
    field: "status",
    admin: "compatible",
    seller: "forbidden",
    notes: "Admin may control lifecycle; seller draft authoring cannot send it.",
  },
  {
    field: "published",
    admin: "same",
    seller: "forbidden",
    notes: "Seller publish stays on a dedicated endpoint.",
  },
  {
    field: "seo",
    admin: "same",
    seller: "unsupported",
    notes: "Seller lane does not accept SEO payload yet.",
  },
  {
    field: "variations",
    admin: "same",
    seller: "unsupported",
    notes: "Seller lane does not accept variants payload yet.",
  },
];

const PRODUCT_STATUSES = new Set(["active", "inactive", "draft"]);

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const normalizePositiveIds = (value: unknown, max = 200) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.map((entry) => asNumber(entry, 0)).filter((entry) => entry > 0))
  ).slice(0, max);
};

const normalizeProductStatus = (value: unknown) => {
  const status = normalizeText(value).toLowerCase();
  return PRODUCT_STATUSES.has(status) ? status : "draft";
};

const normalizeNullableText = (value: unknown) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const normalizeVisibilityCopy = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();

  if (!normalized) return "";
  if (normalized === "private") return "Unpublished";
  if (normalized === "draft in seller workspace") return "Draft";
  if (normalized === "published but waiting admin review") {
    return "Published but review-blocked";
  }
  if (normalized === "published but revision is still required") {
    return "Published but revision-blocked";
  }
  if (normalized === "published but store is inactive") {
    return "Published but store-blocked";
  }
  if (normalized === "published but store is not operational") {
    return "Published but store-not-ready";
  }

  return normalizeText(value);
};

const buildStatusMeta = (status: string) => ({
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

const buildVisibility = (
  published: boolean,
  status: string,
  fallback: Record<string, any> = {}
) => {
  const storefrontVisible =
    typeof fallback?.storefrontVisible === "boolean"
      ? fallback.storefrontVisible
      : published && status === "active";
  const reasonCode =
    normalizeText(fallback?.reasonCode) ||
    (!published
      ? "UNPUBLISHED"
      : storefrontVisible
        ? "STOREFRONT_VISIBLE"
        : "STATUS_NOT_ACTIVE");
  const blockingSignals = Array.isArray(fallback?.blockingSignals)
    ? fallback.blockingSignals
    : [
        ...(!published ? ["PUBLISH_OFF"] : []),
        ...(status !== "active" ? ["STATUS_NOT_ACTIVE"] : []),
      ];
  const stateCode =
    fallback?.stateCode ||
    (!published ? "INTERNAL_ONLY" : storefrontVisible ? "STOREFRONT_VISIBLE" : "PUBLISHED_BLOCKED");
  const normalizedLabel = normalizeVisibilityCopy(fallback?.label);
  const normalizedPublishLabel = normalizeVisibilityCopy(fallback?.publishLabel);
  const normalizedSellerLabel = normalizeVisibilityCopy(fallback?.sellerLabel);
  const normalizedStorefrontLabel = normalizeVisibilityCopy(fallback?.storefrontLabel);

  return {
    ...fallback,
    isPublished: published,
    storefrontVisible,
    stateCode,
    label: normalizedLabel || (published ? "Published" : "Unpublished"),
    publishLabel:
      normalizedPublishLabel || (published ? "Published" : "Unpublished"),
    sellerLabel:
      normalizedSellerLabel ||
      (!published
        ? status === "draft"
          ? "Draft"
          : "Hidden from storefront"
        : storefrontVisible
          ? "Visible in storefront"
          : reasonCode === "REVIEW_PENDING"
            ? "Published but review-blocked"
            : reasonCode === "REVISION_REQUIRED"
              ? "Published but revision-blocked"
              : reasonCode === "STORE_NOT_ACTIVE"
                ? "Published but store-blocked"
                : reasonCode === "STORE_NOT_READY"
                  ? "Published but store-not-ready"
                  : "Published but blocked"),
    storefrontLabel:
      normalizedStorefrontLabel ||
      (storefrontVisible ? "Visible in storefront" : "Hidden from storefront"),
    storefrontReason:
      fallback?.storefrontReason ||
      (!published
        ? "Public storefront queries exclude this product because the publish flag is off."
        : storefrontVisible
          ? "Public storefront queries include this product because publish is on and status is active."
          : "Publish is on, but public storefront queries still exclude this product until status becomes active."),
    sellerHint:
      fallback?.sellerHint ||
      (!published
        ? "Seller can still review this product here, but customers cannot see it yet."
        : storefrontVisible
          ? "Seller and customer views are aligned for visibility."
          : "Seller can review this product here, but customers will not see it until status becomes active."),
    blockingSignals,
    reasonCode,
  };
};

const normalizeAvailability = (availability: any, inventory: any = {}) => {
  const stock = asNumber(availability?.stock ?? inventory?.stock, 0);
  const preOrder = Boolean(availability?.preOrder ?? inventory?.preOrder);
  const preorderDaysValue = Number(
    availability?.preorderDays ?? inventory?.preorderDays ?? 0
  );
  const preorderDays =
    Number.isFinite(preorderDaysValue) && preorderDaysValue > 0 ? preorderDaysValue : null;
  const inStock = stock > 0;
  const stateCode =
    availability?.stateCode ||
    (preOrder ? "PREORDER" : inStock ? "IN_STOCK" : "OUT_OF_STOCK");

  return {
    ...availability,
    stock,
    inStock,
    preOrder,
    preorderDays,
    stateCode,
    label:
      availability?.label ||
      (preOrder
        ? `Pre-order${preorderDays ? ` (${preorderDays} day${preorderDays === 1 ? "" : "s"})` : ""}`
        : inStock
          ? "In stock"
          : "Out of stock"),
    storefrontImpact: availability?.storefrontImpact || "NO_VISIBILITY_CHANGE",
    storefrontReason:
      availability?.storefrontReason ||
      "Current storefront product queries do not hide products based on stock or pre-order flags.",
  };
};

const normalizeCategorySummary = (category: any) => {
  if (!category || typeof category !== "object") return null;

  const id = asNumber(category.id, 0);
  const name = normalizeText(category.name);
  const code = normalizeText(category.code);

  if (!id && !name && !code) return null;

  return {
    id: id || null,
    name: name || "-",
    code: code || null,
  };
};

const normalizePricing = (pricing: any) => {
  const price = asNumber(pricing?.price, 0);
  const salePriceValue = Number(pricing?.salePrice);
  const salePrice =
    Number.isFinite(salePriceValue) && salePriceValue > 0 ? salePriceValue : null;
  const originalPriceValue = Number(pricing?.originalPrice);
  const originalPrice =
    Number.isFinite(originalPriceValue) && originalPriceValue > 0 ? originalPriceValue : null;
  const discountPercent = asNumber(pricing?.discountPercent, 0);

  return {
    price,
    salePrice,
    effectivePrice: salePrice && salePrice > 0 ? salePrice : price,
    originalPrice,
    discountPercent,
  };
};

const normalizeInventory = (inventory: any) => {
  const stock = asNumber(inventory?.stock, 0);
  return {
    ...inventory,
    stock,
    inStock: stock > 0,
    preOrder: Boolean(inventory?.preOrder),
    preorderDays: inventory?.preorderDays ? asNumber(inventory.preorderDays, 0) || null : null,
  };
};

const normalizeProductAuthoring = (value: any) => {
  if (!value || typeof value !== "object") return null;

  return {
    canEditDraft: Boolean(value.canEditDraft),
    editBlockedReason: normalizeText(value.editBlockedReason) || null,
    allowedStatuses: Array.isArray(value.allowedStatuses)
      ? value.allowedStatuses.map((entry: unknown) => normalizeText(entry)).filter(Boolean)
      : [],
  };
};

const normalizeProductPublishing = (value: any) => {
  if (!value || typeof value !== "object") return null;

  return {
    stateCode: normalizeText(value.stateCode) || null,
    isPublished: Boolean(value.isPublished ?? value.published),
    label: normalizeText(value.label) || null,
    isReady: Boolean(value.isReady),
    canPublish: Boolean(value.canPublish),
    canUnpublish: Boolean(value.canUnpublish),
    nextActionLabel: normalizeText(value.nextActionLabel) || null,
    hint: normalizeText(value.hint) || null,
    blockedReasons: Array.isArray(value.blockedReasons)
      ? value.blockedReasons
          .map((entry: any) =>
            entry && typeof entry === "object"
              ? {
                  field: normalizeText(entry.field) || null,
                  code: normalizeText(entry.code) || null,
                  message: normalizeText(entry.message) || null,
                }
              : null
          )
          .filter(Boolean)
      : [],
  };
};

const normalizeProductSubmission = (value: any) => {
  if (!value || typeof value !== "object") return null;

  const revisionNote = normalizeText(value.revisionNote) || null;
  const reviewNote = normalizeText(value.reviewNote) || revisionNote;
  const revisionReason = normalizeText(value.revisionReason) || reviewNote || revisionNote;

  return {
    status: normalizeText(value.status) || "none",
    label: normalizeText(value.label) || null,
    hasSubmission: Boolean(value.hasSubmission),
    submittedAt: value.submittedAt || null,
    submittedByUserId: asNumber(value.submittedByUserId, 0) || null,
    reviewState: normalizeText(value.reviewState) || null,
    storefrontImpact: normalizeText(value.storefrontImpact) || null,
    revisionRequestedAt: value.revisionRequestedAt || null,
    revisionRequestedByUserId: asNumber(value.revisionRequestedByUserId, 0) || null,
    revisionNote,
    reviewNote,
    revisionReason,
    requiresSellerChanges: Boolean(value.requiresSellerChanges),
    canSubmit: Boolean(value.canSubmit),
    canResubmit: Boolean(value.canResubmit),
    canEdit: Boolean(value.canEdit),
    nextActionCode: normalizeText(value.nextActionCode) || null,
    nextActionLabel: normalizeText(value.nextActionLabel) || null,
    nextActionDescription: normalizeText(value.nextActionDescription) || null,
  };
};

const normalizeAssignedCategories = (value: unknown) =>
  Array.isArray(value) ? value.map(normalizeCategorySummary).filter(Boolean) : [];

const normalizeCatalogGovernance = (governance: any) => {
  if (!governance || typeof governance !== "object") return null;

  return {
    mode: normalizeText(governance.mode) || "READ_ONLY_PHASE_1",
    roleCode: normalizeText(governance.roleCode) || null,
    canCreate: Boolean(governance.canCreate),
    canEdit: Boolean(governance.canEdit),
    canDelete: Boolean(governance.canDelete),
    canPublish: Boolean(governance.canPublish),
    canManagePricing: Boolean(governance.canManagePricing),
    canManageInventory: Boolean(governance.canManageInventory),
    sourceOfTruth: normalizeText(governance.sourceOfTruth) || null,
    note: normalizeText(governance.note) || null,
    authoring:
      governance.authoring && typeof governance.authoring === "object"
        ? {
            phase: normalizeText(governance.authoring.phase) || null,
            phaseLabel: normalizeText(governance.authoring.phaseLabel) || null,
            writeLaneActive: Boolean(governance.authoring.writeLaneActive),
            recommendedPhase1:
              normalizeText(governance.authoring.recommendedPhase1) || null,
            legacySellerRoutesPresent: Boolean(
              governance.authoring.legacySellerRoutesPresent
            ),
            legacySellerRoutesMounted: Boolean(
              governance.authoring.legacySellerRoutesMounted
            ),
            canCreateDraft: Boolean(governance.authoring.canCreateDraft),
            canEditDraft: Boolean(governance.authoring.canEditDraft),
            editBlockedReason:
              normalizeText(governance.authoring.editBlockedReason) || null,
            allowedWriteStatuses: Array.isArray(governance.authoring.allowedWriteStatuses)
              ? governance.authoring.allowedWriteStatuses
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
            note: normalizeText(governance.authoring.note) || null,
          }
        : null,
    submissionGovernance:
      governance.submissionGovernance &&
      typeof governance.submissionGovernance === "object"
        ? {
            status: normalizeText(governance.submissionGovernance.status) || "none",
            reviewState:
              normalizeText(governance.submissionGovernance.reviewState) || null,
            canSubmitWhenEnabled: Boolean(
              governance.submissionGovernance.canSubmitWhenEnabled
            ),
            canResubmitWhenEnabled: Boolean(
              governance.submissionGovernance.canResubmitWhenEnabled
            ),
            canEditAfterSubmit: Boolean(
              governance.submissionGovernance.canEditAfterSubmit
            ),
            editLockAppliesWhenSubmitted: Boolean(
              governance.submissionGovernance.editLockAppliesWhenSubmitted
            ),
            sellerCanPublish: Boolean(governance.submissionGovernance.sellerCanPublish),
            requiresSellerChanges: Boolean(
              governance.submissionGovernance.requiresSellerChanges
            ),
            note: normalizeText(governance.submissionGovernance.note) || null,
          }
        : null,
    statusGovernance:
      governance.statusGovernance && typeof governance.statusGovernance === "object"
        ? {
            productStatuses: Array.isArray(governance.statusGovernance.productStatuses)
              ? governance.statusGovernance.productStatuses
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
            publishFlag:
              normalizeText(governance.statusGovernance.publishFlag) || null,
            sellerStateTransitionsActive: Boolean(
              governance.statusGovernance.sellerStateTransitionsActive
            ),
            note: normalizeText(governance.statusGovernance.note) || null,
          }
        : null,
    fieldGovernance:
      governance.fieldGovernance && typeof governance.fieldGovernance === "object"
        ? {
            sellerEditableNow: Array.isArray(governance.fieldGovernance.sellerEditableNow)
              ? governance.fieldGovernance.sellerEditableNow
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
            sellerReadOnly: Array.isArray(governance.fieldGovernance.sellerReadOnly)
              ? governance.fieldGovernance.sellerReadOnly
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
            adminOwned: Array.isArray(governance.fieldGovernance.adminOwned)
              ? governance.fieldGovernance.adminOwned
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
            deferred: Array.isArray(governance.fieldGovernance.deferred)
              ? governance.fieldGovernance.deferred
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
          }
        : null,
  };
};

const normalizeMediaUrls = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry: unknown) => normalizeText(entry))
        .filter(Boolean)
    : [];

const normalizeTagArray = (value: unknown) => normalizeProductDisplayTags(value);

const normalizePlainObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null;

const buildInferredPublishing = ({
  published,
  status,
  submission,
  visibility,
  publishGate = null,
}: {
  published: boolean;
  status: string;
  submission: any;
  visibility: any;
  publishGate?: any;
}) => {
  const submissionStatus = normalizeText(submission?.status) || "none";
  const reviewBlocked =
    submissionStatus === "submitted" || submissionStatus === "needs_revision";
  const blockedReasons = reviewBlocked
    ? [
        {
          field: "submission",
          code:
            submissionStatus === "submitted"
              ? "SELLER_REVIEW_PENDING"
              : "SELLER_REVISION_REQUIRED",
          message:
            normalizeText(publishGate?.hint) ||
            normalizeText(visibility?.storefrontReason) ||
            "Storefront visibility is blocked by the current review state.",
        },
      ]
    : [];

  return {
    stateCode: published ? "PUBLISHED" : status === "draft" ? "DRAFT" : "UNPUBLISHED",
    isPublished: published,
    label: published ? "Published" : status === "draft" ? "Draft" : "Unpublished",
    isReady: status === "active" && submissionStatus === "none",
    canPublish: Boolean(
      !published &&
        (typeof publishGate?.canPublishFromReview === "boolean"
          ? publishGate.canPublishFromReview
          : submissionStatus !== "needs_revision")
    ),
    canUnpublish: published,
    nextActionLabel:
      submissionStatus === "submitted"
        ? "Complete Review"
        : submissionStatus === "needs_revision"
          ? "Wait for Seller Revision"
          : published
            ? "Unpublish"
            : "Publish",
    hint:
      normalizeText(publishGate?.hint) ||
      normalizeText(visibility?.storefrontReason) ||
      null,
    blockedReasons,
  };
};

const buildAdminSubmission = (value: any) =>
  normalizeProductSubmission({
    status: value?.status,
    label: value?.label,
    hasSubmission: value?.hasSubmission,
    submittedAt: value?.submittedAt,
    submittedByUserId: value?.submittedByUserId,
    reviewState: value?.reviewState,
    revisionRequestedAt: value?.revisionRequestedAt,
    revisionRequestedByUserId: value?.revisionRequestedByUserId,
    revisionNote: value?.revisionNote,
    reviewNote: value?.revisionNote,
    revisionReason: value?.revisionNote,
    requiresSellerChanges: value?.requiresSellerChanges,
    canSubmit: false,
    canResubmit: false,
    canEdit: false,
    nextActionLabel: null,
    nextActionDescription: value?.publishGate?.hint || null,
  });

export const mapSellerProductListItem = (item: any): ProductListItemDTO | null => {
  if (!item || typeof item !== "object") return null;

  const status = normalizeProductStatus(item.status ?? item.statusMeta?.code);
  const published = Boolean(item.published ?? item.visibility?.isPublished);

  return {
    ...item,
    id: asNumber(item.id, 0),
    storeId: asNumber(item.storeId, 0),
    name: normalizeText(item.name) || "Untitled product",
    slug: normalizeText(item.slug),
    sku: normalizeText(item.sku) || null,
    status,
    statusMeta: {
      ...buildStatusMeta(status),
      ...(item.statusMeta && typeof item.statusMeta === "object" ? item.statusMeta : {}),
    },
    published,
    visibility: buildVisibility(published, status, item.visibility),
    storefrontVisibilityState:
      normalizeText(item.storefrontVisibilityState || item.visibility?.stateCode) || null,
    pricing: normalizePricing(item.pricing),
    availability: normalizeAvailability(item.availability, item.inventory),
    inventory: {
      ...normalizeInventory(item.inventory),
      ...normalizeAvailability(item.availability, item.inventory),
    },
    publishing: normalizeProductPublishing(item.publishing),
    authoring: normalizeProductAuthoring(item.authoring),
    submission: normalizeProductSubmission(item.submission),
    category: normalizeCategorySummary(item.category),
    ownership: item.ownership && typeof item.ownership === "object" ? item.ownership : null,
    mediaPreviewUrl: normalizeText(item.mediaPreviewUrl) || null,
  };
};

export const mapSellerProductDetail = (item: any): ProductDetailDTO | null => {
  if (!item || typeof item !== "object") return null;

  const status = normalizeProductStatus(item.status ?? item.statusMeta?.code);
  const published = Boolean(item.published ?? item.visibility?.isPublished);
  const category = item.category && typeof item.category === "object" ? item.category : {};
  const media = item.media && typeof item.media === "object" ? item.media : {};

  return {
    ...item,
    id: asNumber(item.id, 0),
    storeId: asNumber(item.storeId, 0),
    name: normalizeText(item.name) || "Untitled product",
    slug: normalizeText(item.slug),
    sku: normalizeText(item.sku) || null,
    status,
    statusMeta: {
      ...buildStatusMeta(status),
      ...(item.statusMeta && typeof item.statusMeta === "object" ? item.statusMeta : {}),
    },
    published,
    visibility: buildVisibility(published, status, item.visibility),
    storefrontVisibilityState:
      normalizeText(item.storefrontVisibilityState || item.visibility?.stateCode) || null,
    pricing: normalizePricing(item.pricing),
    availability: normalizeAvailability(item.availability, item.inventory),
    inventory: {
      ...normalizeInventory(item.inventory),
      ...normalizeAvailability(item.availability, item.inventory),
    },
    publishing: normalizeProductPublishing(item.publishing),
    authoring: normalizeProductAuthoring(item.authoring),
    submission: normalizeProductSubmission(item.submission),
    ownership: item.ownership && typeof item.ownership === "object" ? item.ownership : null,
    governance: normalizeCatalogGovernance(item.governance),
    category: {
      primary: normalizeCategorySummary(category.primary),
      default: normalizeCategorySummary(category.default),
      assigned: normalizeAssignedCategories(category.assigned),
    },
    media: {
      ...media,
      promoImageUrl: normalizeText(media.promoImageUrl) || null,
      videoUrl: normalizeText(media.videoUrl) || null,
      imageUrls: normalizeMediaUrls(media.imageUrls),
      totalImages: asNumber(media.totalImages, 0),
    },
    attributes:
      item.attributes && typeof item.attributes === "object"
        ? {
            ...item.attributes,
            barcode: normalizeText(item.attributes.barcode) || null,
            gtin: normalizeText(item.attributes.gtin) || null,
            tags: normalizeTagArray(item.attributes.tags),
          }
        : {
            barcode: null,
            gtin: null,
            tags: [],
          },
  };
};

export const mapAdminProductListItem = (item: any): ProductListItemDTO | null => {
  if (!item || typeof item !== "object") return null;

  const status = normalizeProductStatus(item.status ?? item.statusMeta?.code);
  const published = Boolean(item.published ?? item.visibility?.isPublished);
  const submission = buildAdminSubmission(item.sellerSubmission);
  const visibility = buildVisibility(published, status, item.visibility);
  const publishing = normalizeProductPublishing(
    buildInferredPublishing({
      published,
      status,
      submission,
      visibility,
      publishGate: item?.sellerSubmission?.publishGate,
    })
  );
  const availability = normalizeAvailability({ stock: item.stock }, { stock: item.stock });

  return {
    ...item,
    id: asNumber(item.id, 0),
    storeId: asNumber(item.storeId, 0),
    name: normalizeText(item.name) || "Untitled product",
    slug: normalizeText(item.slug),
    sku: normalizeNullableText(item.sku),
    status,
    statusMeta: {
      ...buildStatusMeta(status),
      ...(item.statusMeta && typeof item.statusMeta === "object" ? item.statusMeta : {}),
    },
    published,
    visibility,
    publishing,
    submission,
    authoring: null,
    storefrontVisibilityState:
      normalizeText(item.storefrontVisibilityState || item.visibility?.stateCode) || null,
    pricing: normalizePricing({
      price: item.price,
      salePrice: item.salePrice,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
    }),
    availability,
    inventory: {
      ...normalizeInventory({ stock: item.stock }),
      ...availability,
    },
    ownership:
      typeof item.storeId !== "undefined"
        ? {
            storeId: asNumber(item.storeId, 0),
            tenantScoped: asNumber(item.storeId, 0) > 0,
          }
        : null,
    category: normalizeCategorySummary(item.defaultCategory ?? item.category),
    mediaPreviewUrl:
      normalizeText(item.mediaPreviewUrl || item.promoImagePath || item.imageUrl) || null,
  };
};

export const mapAdminProductDetail = (item: any): ProductDetailDTO | null => {
  if (!item || typeof item !== "object") return null;

  const status = normalizeProductStatus(item.status ?? item.statusMeta?.code);
  const published = Boolean(item.published ?? item.visibility?.isPublished);
  const submission = buildAdminSubmission(item.sellerSubmission);
  const visibility = buildVisibility(published, status, item.visibility);
  const publishing = normalizeProductPublishing(
    buildInferredPublishing({
      published,
      status,
      submission,
      visibility,
      publishGate: item?.sellerSubmission?.publishGate,
    })
  );
  const availability = normalizeAvailability({ stock: item.stock }, { stock: item.stock });
  const defaultCategory = normalizeCategorySummary(item.defaultCategory ?? item.category);
  const assignedCategories = normalizeAssignedCategories(item.categories);
  const imageUrls = normalizeMediaUrls(item.imagePaths);
  const promoImageUrl =
    normalizeText(item.promoImagePath || item.imageUrl) || imageUrls[0] || null;
  const normalizedImageUrls =
    promoImageUrl && !imageUrls.includes(promoImageUrl)
      ? [promoImageUrl, ...imageUrls]
      : imageUrls;
  const tags = normalizeTagArray(item.tags);
  const variations = item?.variations ?? null;
  const wholesale = item?.wholesale ?? null;

  return {
    ...item,
    id: asNumber(item.id, 0),
    storeId: asNumber(item.storeId, 0),
    name: normalizeText(item.name) || "Untitled product",
    slug: normalizeText(item.slug),
    sku: normalizeNullableText(item.sku),
    status,
    statusMeta: {
      ...buildStatusMeta(status),
      ...(item.statusMeta && typeof item.statusMeta === "object" ? item.statusMeta : {}),
    },
    published,
    visibility,
    publishing,
    submission,
    authoring: null,
    governance: null,
    storefrontVisibilityState:
      normalizeText(item.storefrontVisibilityState || item.visibility?.stateCode) || null,
    pricing: normalizePricing({
      price: item.price,
      salePrice: item.salePrice,
      originalPrice: item.originalPrice,
      discountPercent: item.discountPercent,
    }),
    availability,
    inventory: {
      ...normalizeInventory({ stock: item.stock }),
      ...availability,
    },
    ownership:
      typeof item.storeId !== "undefined"
        ? {
            storeId: asNumber(item.storeId, 0),
            tenantScoped: asNumber(item.storeId, 0) > 0,
          }
        : null,
    descriptions: {
      description: normalizeNullableText(item.description),
      notes: null,
    },
    category: {
      primary: defaultCategory,
      default: defaultCategory,
      assigned: assignedCategories,
    },
    media: {
      promoImageUrl,
      videoUrl: null,
      imageUrls: normalizedImageUrls,
      totalImages: normalizedImageUrls.length,
    },
    attributes: {
      barcode: normalizeNullableText(item.barcode),
      gtin: null,
      tags,
    },
    variations: {
      hasVariations: Array.isArray(variations)
        ? variations.length > 0
        : Boolean(
            normalizePlainObject(variations) &&
              Object.keys(normalizePlainObject(variations) || {}).length > 0
          ),
      raw: variations,
    },
    wholesale: {
      hasWholesale: Array.isArray(wholesale)
        ? wholesale.length > 0
        : Boolean(
            normalizePlainObject(wholesale) &&
              Object.keys(normalizePlainObject(wholesale) || {}).length > 0
          ),
      raw: wholesale,
    },
  };
};

const assertAdminCompatibleStatus = (value: unknown) => {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return undefined;
  if (normalized === "active" || normalized === "inactive") return normalized;
  throw new Error("Admin product write payload does not support draft lifecycle state.");
};

export const toAdminProductWritePayload = (value: ProductWriteDTO = {} as ProductWriteDTO) => {
  const categoryIds = normalizePositiveIds(value.categoryIds);
  const defaultCategoryId = asNumber(value.defaultCategoryId, 0) || null;
  const imageUrls = normalizeMediaUrls(value.imageUrls);
  const payload: Record<string, any> = {
    name: normalizeText(value.name),
    description: normalizeNullableText(value.description),
    sku: normalizeNullableText(value.sku),
    barcode: normalizeNullableText(value.barcode),
    slug: normalizeNullableText(value.slug),
    categoryIds,
    defaultCategoryId,
    categoryId: defaultCategoryId || undefined,
    price: typeof value.price === "number" ? value.price : 0,
    salePrice:
      typeof value.salePrice === "number" || value.salePrice === null
        ? value.salePrice
        : undefined,
    stock: typeof value.stock === "number" ? value.stock : 0,
    imageUrls,
    imageUrl: imageUrls[0] || null,
    tags: normalizeTagArray(value.tags),
    seo: typeof value.seo === "undefined" ? undefined : value.seo,
    variations: typeof value.variations === "undefined" ? undefined : value.variations,
  };

  const status = assertAdminCompatibleStatus(value.status);
  if (typeof status !== "undefined") payload.status = status;
  if (typeof value.published === "boolean") payload.published = value.published;

  return payload;
};

export const toSellerProductWritePayload = (value: ProductWriteDTO = {} as ProductWriteDTO) => {
  return {
    name: normalizeText(value.name),
    description: normalizeNullableText(value.description),
    sku: normalizeNullableText(value.sku),
    barcode: normalizeNullableText(value.barcode),
    slug: normalizeNullableText(value.slug),
    categoryIds: normalizePositiveIds(value.categoryIds),
    defaultCategoryId: asNumber(value.defaultCategoryId, 0) || null,
    price: typeof value.price === "number" ? value.price : 0,
    salePrice:
      typeof value.salePrice === "number" || value.salePrice === null
        ? value.salePrice
        : null,
    stock: typeof value.stock === "number" ? value.stock : 0,
    imageUrls: normalizeMediaUrls(value.imageUrls),
    tags: normalizeTagArray(value.tags),
  };
};
