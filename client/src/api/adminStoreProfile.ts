import { api } from "./axios.ts";

const textOrNull = (value: unknown) => {
  const normalized = String(value ?? "").trim();
  return normalized || null;
};

const textOrFallback = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const toStringList = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => textOrNull(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];

const normalizeFieldMatrix = (value: unknown) =>
  Array.isArray(value)
    ? value
        .map((entry) => ({
          key: textOrFallback((entry as any)?.key),
          label: textOrFallback((entry as any)?.label, "Unknown field"),
          editableBySeller: Boolean((entry as any)?.editableBySeller),
          editableByAdmin: Boolean((entry as any)?.editableByAdmin),
          sellerEditable: Boolean((entry as any)?.sellerEditable),
          adminOwned: Boolean((entry as any)?.adminOwned),
          publicSafe: Boolean((entry as any)?.publicSafe),
          readOnlyForSeller: Boolean((entry as any)?.readOnlyForSeller),
          storefrontUsage: textOrFallback((entry as any)?.storefrontUsage, "NOT_SURFACED"),
          notes: textOrNull((entry as any)?.notes),
        }))
        .filter((entry) => entry.key)
    : [];

const normalizeStoreProfileSnapshot = (payload: any) => {
  if (!payload) return null;

  const completeness = payload?.completeness || {};
  const missingFields = Array.isArray(completeness?.missingFields)
    ? completeness.missingFields
        .map((entry: any) => ({
          key: textOrFallback(entry?.key),
          label: textOrFallback(entry?.label, "Unknown field"),
        }))
        .filter((entry: any) => entry.key)
    : [];

  return {
    id: Number(payload?.id || 0),
    name: textOrFallback(payload?.name),
    slug: textOrFallback(payload?.slug),
    status: textOrFallback(payload?.status, "ACTIVE"),
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
      adminOwnedFields: toStringList(payload?.governance?.adminOwnedFields),
      sellerEditableFields: toStringList(payload?.governance?.sellerEditableFields),
      publicSafeFields: toStringList(payload?.governance?.publicSafeFields),
      managedBy: textOrFallback(payload?.governance?.managedBy),
      note: textOrNull(payload?.governance?.note),
    },
    contract: {
      notes: toStringList(payload?.contract?.notes),
      categories: {
        adminOwnedFields: toStringList(payload?.contract?.categories?.adminOwnedFields),
        sellerEditableFields: toStringList(payload?.contract?.categories?.sellerEditableFields),
        publicSafeFields: toStringList(payload?.contract?.categories?.publicSafeFields),
        publicStorefrontFields: toStringList(payload?.contract?.categories?.publicStorefrontFields),
        operationalClientFields: toStringList(
          payload?.contract?.categories?.operationalClientFields
        ),
        notSurfacedFields: toStringList(payload?.contract?.categories?.notSurfacedFields),
      },
      fieldMatrix: normalizeFieldMatrix(payload?.contract?.fieldMatrix),
    },
    completeness: {
      score: Number(completeness?.score || 0),
      completedFields: Number(completeness?.completedFields || 0),
      totalFields: Number(completeness?.totalFields || 0),
      isComplete: Boolean(completeness?.isComplete),
      label: textOrFallback(completeness?.label, "Profile needs attention"),
      description: textOrNull(completeness?.description),
      missingFields,
    },
    createdAt: payload?.createdAt || null,
    updatedAt: payload?.updatedAt || null,
  };
};

const normalizePublicIdentity = (payload: any) => ({
  id: payload?.id != null ? Number(payload.id) : null,
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
  summary: {
    status: {
      code: textOrFallback(payload?.summary?.status?.code, "UNKNOWN"),
      label: textOrFallback(payload?.summary?.status?.label, "Unavailable"),
      tone: textOrFallback(payload?.summary?.status?.tone, "neutral"),
    },
    operationalReadiness: payload?.summary?.operationalReadiness
      ? {
          code: textOrFallback(payload.summary.operationalReadiness.code, "UNKNOWN"),
          label: textOrFallback(
            payload.summary.operationalReadiness.label,
            "Unavailable"
          ),
          tone: textOrFallback(payload.summary.operationalReadiness.tone, "neutral"),
          description: textOrNull(payload.summary.operationalReadiness.description),
          isReady: Boolean(payload.summary.operationalReadiness.isReady),
        }
      : null,
    productCount:
      Number.isFinite(Number(payload?.summary?.productCount))
        ? Number(payload.summary.productCount)
        : null,
    ratingAverage:
      Number.isFinite(Number(payload?.summary?.ratingAverage))
        ? Number(payload.summary.ratingAverage)
        : null,
    ratingCount:
      Number.isFinite(Number(payload?.summary?.ratingCount))
        ? Number(payload.summary.ratingCount)
        : 0,
  },
  contract: {
    notes: toStringList(payload?.contract?.notes),
  },
});

const normalizeAdminStoreProfileEntry = (payload: any) => ({
  store: normalizeStoreProfileSnapshot(payload?.store),
  publicIdentity: normalizePublicIdentity(payload?.publicIdentity || payload?.store),
  owner: payload?.owner
    ? {
        id: Number(payload.owner.id || 0) || null,
        name: textOrNull(payload.owner.name),
        email: textOrNull(payload.owner.email),
        role: textOrNull(payload.owner.role),
      }
    : null,
});

export const fetchAdminStoreProfiles = async () => {
  const { data } = await api.get("/admin/store/profiles");
  return Array.isArray(data?.data) ? data.data.map(normalizeAdminStoreProfileEntry) : [];
};

export const updateAdminStoreProfile = async (
  storeId: number | string,
  payload: Record<string, unknown>
) => {
  const { data } = await api.patch(`/admin/store/profiles/${storeId}`, payload);
  return normalizeAdminStoreProfileEntry(data?.data ?? null);
};
