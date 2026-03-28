import { api } from "./axios.ts";

const textOrNull = (value: unknown) => {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value || "").trim();
  return normalized || fallback;
};

const toStringList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => textOrNull(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

const normalizeMissingFields = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => ({
          key: textOrFallback((entry as any)?.key),
          label: textOrFallback((entry as any)?.label, "Unknown field"),
        }))
        .filter((entry) => entry.key)
    : [];

const STORE_PROFILE_STOREFRONT_USAGE = new Set([
  "PUBLIC_STOREFRONT",
  "OPERATIONAL_CLIENT",
  "NOT_SURFACED",
]);

const normalizeStorefrontUsage = (value: unknown) => {
  const normalized = textOrFallback(value, "NOT_SURFACED");
  return STORE_PROFILE_STOREFRONT_USAGE.has(normalized)
    ? normalized
    : "NOT_SURFACED";
};

const normalizeFieldMatrix = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => ({
          key: textOrFallback((entry as any)?.key),
          label: textOrFallback((entry as any)?.label, "Unknown field"),
          editableBySeller: Boolean((entry as any)?.editableBySeller),
          readOnlyForSeller: Boolean((entry as any)?.readOnlyForSeller),
          storefrontUsage: normalizeStorefrontUsage((entry as any)?.storefrontUsage),
          notes: textOrNull((entry as any)?.notes),
        }))
        .filter((entry) => entry.key)
    : [];

const normalizeStoreProfile = (payload: any) => {
  if (!payload) return null;

  const completeness = payload?.completeness || {};
  const missingFields = normalizeMissingFields(completeness?.missingFields);
  const totalFields = Number(completeness?.totalFields || missingFields.length || 0);
  const completedFields = Number(
    completeness?.completedFields ??
      Math.max(totalFields - missingFields.length, 0)
  );
  const score =
    typeof completeness?.score === "number"
      ? completeness.score
      : totalFields > 0
        ? Math.round((completedFields / totalFields) * 100)
        : 0;

  return {
    id: Number(payload?.id || 0),
    name: textOrFallback(payload?.name),
    slug: textOrFallback(payload?.slug),
    description: textOrNull(payload?.description),
    logoUrl: textOrNull(payload?.logoUrl),
    bannerUrl: textOrNull(payload?.bannerUrl),
    email: textOrNull(payload?.email),
    phone: textOrNull(payload?.phone),
    whatsapp: textOrNull(payload?.whatsapp),
    websiteUrl: textOrNull(payload?.websiteUrl),
    instagramUrl: textOrNull(payload?.instagramUrl),
    tiktokUrl: textOrNull(payload?.tiktokUrl),
    addressLine1: textOrNull(payload?.addressLine1),
    addressLine2: textOrNull(payload?.addressLine2),
    city: textOrNull(payload?.city),
    province: textOrNull(payload?.province),
    postalCode: textOrNull(payload?.postalCode),
    country: textOrNull(payload?.country),
    status: textOrFallback(payload?.status, "ACTIVE"),
    verificationStatus: textOrNull(payload?.verificationStatus),
    statusMeta: {
      code: textOrFallback(payload?.statusMeta?.code || payload?.status, "ACTIVE"),
      label: textOrFallback(payload?.statusMeta?.label || payload?.status, "Active"),
      tone: textOrFallback(payload?.statusMeta?.tone, "neutral"),
      description: textOrNull(payload?.statusMeta?.description),
    },
    governance: {
      canView: payload?.governance?.canView !== false,
      canEdit: Boolean(payload?.governance?.canEdit),
      editableFields: toStringList(payload?.governance?.editableFields),
      readOnlyFields: toStringList(payload?.governance?.readOnlyFields),
      managedBy: textOrFallback(payload?.governance?.managedBy, "SELLER_WORKSPACE"),
      note: textOrNull(payload?.governance?.note),
    },
    operationalReadiness: payload?.operationalReadiness
      ? {
          code: textOrFallback(payload.operationalReadiness.code, "UNKNOWN"),
          label: textOrFallback(payload.operationalReadiness.label, "Unavailable"),
          tone: textOrFallback(payload.operationalReadiness.tone, "stone"),
          description: textOrNull(payload.operationalReadiness.description),
          isReady: Boolean(payload.operationalReadiness.isReady),
          blockedBy: textOrNull(payload.operationalReadiness.blockedBy),
          storeStatusCode: textOrNull(payload.operationalReadiness.storeStatusCode),
          paymentProfileCode: textOrNull(payload.operationalReadiness.paymentProfileCode),
        }
      : null,
    boundaries: {
      readinessSourceOfTruth: textOrNull(payload?.boundaries?.readinessSourceOfTruth),
      storefrontBoundary: textOrNull(payload?.boundaries?.storefrontBoundary),
    },
    contract: {
      notes: toStringList(payload?.contract?.notes),
      categories: {
        editableFields: toStringList(payload?.contract?.categories?.editableFields),
        readOnlyFields: toStringList(payload?.contract?.categories?.readOnlyFields),
        publicStorefrontFields: toStringList(
          payload?.contract?.categories?.publicStorefrontFields
        ),
        operationalClientFields: toStringList(
          payload?.contract?.categories?.operationalClientFields
        ),
        notSurfacedFields: toStringList(payload?.contract?.categories?.notSurfacedFields),
      },
      fieldMatrix: normalizeFieldMatrix(payload?.contract?.fieldMatrix),
    },
    completeness: {
      score,
      completedFields,
      totalFields,
      isComplete:
        typeof completeness?.isComplete === "boolean"
          ? completeness.isComplete
          : missingFields.length === 0,
      label: textOrFallback(
        completeness?.label,
        missingFields.length === 0 ? "Profile complete" : "Profile needs attention"
      ),
      description: textOrNull(completeness?.description),
      missingFields,
    },
    createdAt: payload?.createdAt || null,
    updatedAt: payload?.updatedAt || null,
  };
};

export const getSellerStoreProfile = async (storeId: number | string) => {
  const { data } = await api.get(`/seller/stores/${storeId}/store-profile`);
  return normalizeStoreProfile(data?.data ?? null);
};

export const updateSellerStoreProfile = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.patch(`/seller/stores/${storeId}/store-profile`, payload);
  return normalizeStoreProfile(data?.data ?? null);
};
