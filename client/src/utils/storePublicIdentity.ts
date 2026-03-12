export type NormalizedPublicStoreIdentity = {
  id: number | null;
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  email: string;
  phone: string;
  whatsapp: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  createdAt: string;
  updatedAt: string;
  summary: {
    status: {
      code: string;
      label: string;
      tone: string;
    };
    productCount: number | null;
    ratingAverage: number | null;
    ratingCount: number;
    followerCount: number | null;
    responseRate: number | null;
    responseTimeLabel: string;
    joinedAt: string;
    chatMode: "enabled" | "contact_fallback" | "disabled";
    canChat: boolean;
    canContact: boolean;
  };
};

const toText = (value: unknown, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const isSafeWhatsAppUrl = (value: unknown) => {
  const normalized = toText(value);
  if (!normalized) return false;
  const lowered = normalized.toLowerCase();
  return (
    lowered.startsWith("https://wa.me/") ||
    lowered.startsWith("https://api.whatsapp.com/")
  );
};

export const normalizePublicStoreIdentity = (
  payload: { data?: Partial<NormalizedPublicStoreIdentity> | null } | null | undefined
): NormalizedPublicStoreIdentity => {
  const source = payload?.data && typeof payload.data === "object" ? payload.data : {};
  const id = Number(source.id);

  return {
    id: Number.isFinite(id) ? id : null,
    name: toText(source.name),
    slug: toText(source.slug),
    description: toText(source.description),
    logoUrl: toText(source.logoUrl),
    email: toText(source.email),
    phone: toText(source.phone),
    whatsapp: toText(source.whatsapp),
    addressLine1: toText(source.addressLine1),
    addressLine2: toText(source.addressLine2),
    city: toText(source.city),
    province: toText(source.province),
    postalCode: toText(source.postalCode),
    country: toText(source.country),
    createdAt: toText(source.createdAt),
    updatedAt: toText(source.updatedAt),
    summary: {
      status: {
        code: toText((source as any)?.summary?.status?.code, "UNKNOWN"),
        label: toText((source as any)?.summary?.status?.label, "Unavailable"),
        tone: toText((source as any)?.summary?.status?.tone, "neutral"),
      },
      productCount: Number.isFinite(Number((source as any)?.summary?.productCount))
        ? Number((source as any)?.summary?.productCount)
        : null,
      ratingAverage: Number.isFinite(Number((source as any)?.summary?.ratingAverage))
        ? Number((source as any)?.summary?.ratingAverage)
        : null,
      ratingCount: Number.isFinite(Number((source as any)?.summary?.ratingCount))
        ? Number((source as any)?.summary?.ratingCount)
        : 0,
      followerCount: Number.isFinite(Number((source as any)?.summary?.followerCount))
        ? Number((source as any)?.summary?.followerCount)
        : null,
      responseRate: Number.isFinite(Number((source as any)?.summary?.responseRate))
        ? Number((source as any)?.summary?.responseRate)
        : null,
      responseTimeLabel: toText((source as any)?.summary?.responseTimeLabel),
      joinedAt: toText((source as any)?.summary?.joinedAt, toText(source.createdAt)),
      chatMode: ["enabled", "contact_fallback"].includes(
        toText((source as any)?.summary?.chatMode).toLowerCase()
      )
        ? ((source as any).summary.chatMode as "enabled" | "contact_fallback")
        : "disabled",
      canChat: Boolean((source as any)?.summary?.canChat),
      canContact: Boolean((source as any)?.summary?.canContact),
    },
  };
};

export const resolvePreferredText = (
  preferredValue: unknown,
  fallbackValue: unknown,
  finalFallback = ""
) =>
  toText(preferredValue, toText(fallbackValue, finalFallback));

export const toPreferredWhatsAppLink = (preferredValue: unknown, fallbackValue: unknown) => {
  const preferred = toText(preferredValue);
  if (isSafeWhatsAppUrl(preferred)) return preferred;

  const digits = preferred.replace(/\D+/g, "");
  if (digits) {
    return `https://wa.me/${digits}`;
  }

  return toText(fallbackValue);
};
