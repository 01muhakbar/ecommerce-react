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
  updatedAt: string;
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
    updatedAt: toText(source.updatedAt),
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
