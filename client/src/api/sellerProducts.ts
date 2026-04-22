import { api } from "./axios.ts";
import {
  mapSellerProductDetail as mapSellerProductDetailDto,
  mapSellerProductListItem as mapSellerProductListItemDto,
  toSellerProductWritePayload,
  type ProductWriteDTO,
} from "./productDto.ts";

type SellerProductsQuery = {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: string;
  published?: "" | "true" | "false";
  submissionStatus?:
    | ""
    | "none"
    | "submitted"
    | "needs_revision"
    | "review_queue"
    | "ready_to_submit";
  visibilityState?: "" | "internal_only" | "storefront_visible" | "published_blocked";
};

type SellerBulkSubmissionAction = "submit_review" | "resubmit_review";

type SellerProductDraftPayload = ProductWriteDTO;

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

const normalizeCategoryReference = (category: any) => {
  if (!category || typeof category !== "object") return null;

  const id = asNumber(category.id, 0);
  const name = normalizeText(category.name);
  const code = normalizeText(category.code);

  if (!id && !name && !code) return null;

  return {
    id: id || null,
    name: name || "-",
    code: code || null,
    parentId: asNumber(category.parentId ?? category.parent_id, 0) || null,
    published: Boolean(category.published ?? true),
  };
};

const normalizeProductListItem = (item: any) => {
  return mapSellerProductListItemDto(item);
};

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

const normalizeProductSummary = (value: any) => ({
  totalProducts: asNumber(value?.totalProducts, 0),
  drafts: asNumber(value?.drafts, 0),
  readyToSubmit: asNumber(value?.readyToSubmit, 0),
  active: asNumber(value?.active, 0),
  inactive: asNumber(value?.inactive, 0),
  submitted: asNumber(value?.submitted, 0),
  needsRevision: asNumber(value?.needsRevision, 0),
  reviewQueue: asNumber(
    value?.reviewQueue,
    asNumber(value?.submitted, 0) + asNumber(value?.needsRevision, 0)
  ),
  storefrontVisible: asNumber(value?.storefrontVisible, 0),
  publishedBlocked: asNumber(value?.publishedBlocked, 0),
  internalOnly: asNumber(value?.internalOnly, 0),
});

const normalizeProductDetail = (item: any) => {
  return mapSellerProductDetailDto(item);
};

export const getSellerProducts = async (
  storeId: number | string,
  query: SellerProductsQuery = {}
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products`, {
    params: {
      page: query.page,
      limit: query.limit,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      published: query.published || undefined,
      submissionStatus: query.submissionStatus || undefined,
      visibilityState: query.visibilityState || undefined,
    },
  });
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") return null;

  return {
    ...payload,
    contract: payload.contract && typeof payload.contract === "object" ? payload.contract : null,
    governance: normalizeCatalogGovernance(payload.governance),
    summary: normalizeProductSummary(payload.summary),
    items: Array.isArray(payload.items)
      ? payload.items.map(normalizeProductListItem).filter(Boolean)
      : [],
    pagination: {
      page: asNumber(payload.pagination?.page, asNumber(query.page, 1)),
      limit: asNumber(payload.pagination?.limit, asNumber(query.limit, 20)),
      total: asNumber(payload.pagination?.total, 0),
    },
  };
};

export const exportSellerProducts = async (
  storeId: number | string,
  options: {
    ids?: number[];
    filters?: SellerProductsQuery;
  } = {}
) => {
  try {
    const response = await api.post(
      `/seller/stores/${storeId}/products/export`,
      {
        ...(Array.isArray(options.ids) ? { ids: normalizePositiveIds(options.ids, 500) } : {}),
        filters: options.filters || {},
      },
      {
        responseType: "blob",
      }
    );
    const disposition = String(response.headers?.["content-disposition"] || "");
    const filenameMatch = disposition.match(/filename="?(?<filename>[^"]+)"?/i);

    return {
      blob: response.data as Blob,
      filename: filenameMatch?.groups?.filename || `seller-products-${storeId}.csv`,
    };
  } catch (error: any) {
    const blob = error?.response?.data;
    if (blob instanceof Blob) {
      let payload = null;

      try {
        const text = await blob.text();
        payload = JSON.parse(text);
      } catch {
        // Fall through to the original transport error.
      }

      if (payload && typeof payload === "object") {
        const nextError = new Error(
          normalizeText(payload?.message) || "Failed to export seller products."
        ) as Error & { response?: any };
        (nextError as any).response = {
          ...error?.response,
          data: payload,
        };
        throw nextError;
      }
    }

    throw error;
  }
};

export const bulkSubmitSellerProductsForReview = async (
  storeId: number | string,
  action: SellerBulkSubmissionAction,
  ids: number[]
) => {
  const { data } = await api.post(`/seller/stores/${storeId}/products/bulk-submission`, {
    action,
    ids: normalizePositiveIds(ids),
  });

  const payload = data?.data ?? null;
  return {
    action: normalizeText(payload?.action),
    actionLabel: normalizeText(payload?.actionLabel),
    summary: {
      requested: asNumber(payload?.summary?.requested, 0),
      successCount: asNumber(payload?.summary?.successCount, 0),
      failureCount: asNumber(payload?.summary?.failureCount, 0),
    },
    results: Array.isArray(payload?.results)
      ? payload.results.map((entry: any) => ({
          id: asNumber(entry?.id, 0),
          name: normalizeText(entry?.name) || null,
          status: normalizeText(entry?.status) || "failed",
          code: normalizeText(entry?.code) || null,
          message: normalizeText(entry?.message) || null,
          submissionStatus: normalizeText(entry?.submissionStatus) || null,
        }))
      : [],
  };
};

export const getSellerProductDetail = async (
  storeId: number | string,
  productId: number | string
) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products/${productId}`);
  return normalizeProductDetail(data?.data ?? null);
};

export const getSellerProductAuthoringMeta = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/products/authoring/meta`);
  const payload = data?.data ?? null;
  if (!payload || typeof payload !== "object") return null;

  return {
    governance: normalizeCatalogGovernance(payload.governance),
    draftDefaults:
      payload.draftDefaults && typeof payload.draftDefaults === "object"
        ? {
            status: normalizeProductStatus(payload.draftDefaults.status),
            published: Boolean(payload.draftDefaults.published),
            submissionStatus: normalizeText(payload.draftDefaults.submissionStatus) || "none",
            name: normalizeText(payload.draftDefaults.name),
            description: normalizeText(payload.draftDefaults.description),
            sku: normalizeText(payload.draftDefaults.sku),
            barcode: normalizeText(payload.draftDefaults.barcode),
            slug: normalizeText(payload.draftDefaults.slug),
            categoryIds: Array.isArray(payload.draftDefaults.categoryIds)
              ? payload.draftDefaults.categoryIds
                  .map((value: unknown) => asNumber(value, 0))
                  .filter((value: number) => value > 0)
              : [],
            defaultCategoryId:
              asNumber(payload.draftDefaults.defaultCategoryId, 0) || null,
            price: asNumber(payload.draftDefaults.price, 0),
            salePrice:
              payload.draftDefaults.salePrice === null ||
              typeof payload.draftDefaults.salePrice === "undefined"
                ? null
                : asNumber(payload.draftDefaults.salePrice, 0),
            stock: asNumber(payload.draftDefaults.stock, 0),
            imageUrls: Array.isArray(payload.draftDefaults.imageUrls)
              ? payload.draftDefaults.imageUrls
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
            tags: Array.isArray(payload.draftDefaults.tags)
              ? payload.draftDefaults.tags
                  .map((value: unknown) => normalizeText(value))
                  .filter(Boolean)
              : [],
          }
        : null,
    references:
      payload.references && typeof payload.references === "object"
        ? {
            categories: Array.isArray(payload.references.categories)
              ? payload.references.categories
                  .map(normalizeCategoryReference)
                  .filter(Boolean)
              : [],
          }
        : { categories: [] },
  };
};

export const createSellerProductDraft = async (
  storeId: number | string,
  payload: SellerProductDraftPayload
) => {
  const { data } = await api.post(
    `/seller/stores/${storeId}/products/drafts`,
    toSellerProductWritePayload(payload)
  );
  return normalizeProductDetail(data?.data ?? null);
};

export const updateSellerProductDraft = async (
  storeId: number | string,
  productId: number | string,
  payload: SellerProductDraftPayload
) => {
  const { data } = await api.patch(
    `/seller/stores/${storeId}/products/${productId}/draft`,
    toSellerProductWritePayload(payload)
  );
  return normalizeProductDetail(data?.data ?? null);
};

export const submitSellerProductDraftForReview = async (
  storeId: number | string,
  productId: number | string
) => {
  const { data } = await api.post(
    `/seller/stores/${storeId}/products/${productId}/submit-review`
  );
  return normalizeProductDetail(data?.data ?? null);
};

export const setSellerProductPublished = async (
  storeId: number | string,
  productId: number | string,
  published: boolean
) => {
  const { data } = await api.patch(
    `/seller/stores/${storeId}/products/${productId}/published`,
    { published: Boolean(published) }
  );
  return normalizeProductDetail(data?.data ?? null);
};

export const uploadSellerProductImage = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ data?: { url?: string } }>("/upload", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const url = normalizeText(data?.data?.url);
  if (!url) {
    throw new Error("Upload succeeded without URL.");
  }
  return url;
};
