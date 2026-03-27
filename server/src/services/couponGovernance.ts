import type { CouponScopeType } from "../models/Coupon.js";

export const COUPON_SCOPE_TYPES: CouponScopeType[] = ["PLATFORM", "STORE"];

export type CouponGovernanceScope = {
  scopeType: CouponScopeType;
  storeId: number | null;
  ownership: "ADMIN_PLATFORM" | "SELLER_STORE_ADMIN_GOVERNED";
};

const getPlain = (value: any) => (typeof value?.get === "function" ? value.get({ plain: true }) : value);

const toFiniteNumber = (value: any): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toIso = (value: any): string | null => {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const normalizeCouponScopeType = (value: any): CouponScopeType => {
  const normalized = String(value || "").trim().toUpperCase();
  return normalized === "STORE" ? "STORE" : "PLATFORM";
};

export const resolveCouponGovernanceScope = (coupon: any): CouponGovernanceScope => {
  const plain = getPlain(coupon);
  const storeId = toFiniteNumber(
    plain?.storeId ?? plain?.store_id ?? plain?.store?.id ?? null
  );
  const scopeType = normalizeCouponScopeType(
    plain?.scopeType ?? plain?.scope_type ?? (storeId ? "STORE" : "PLATFORM")
  );
  return {
    scopeType,
    storeId: scopeType === "STORE" ? storeId : null,
    ownership: scopeType === "STORE" ? "SELLER_STORE_ADMIN_GOVERNED" : "ADMIN_PLATFORM",
  };
};

export const getCouponTimeWindow = (coupon: any) => {
  const plain = getPlain(coupon);
  const startsAt = toIso(plain?.startsAt ?? plain?.starts_at ?? null);
  const expiresAt = toIso(plain?.expiresAt ?? plain?.expires_at ?? null);
  const now = Date.now();
  const started = !startsAt || Date.parse(startsAt) <= now;
  const expired = Boolean(expiresAt && Date.parse(expiresAt) < now);
  return {
    startsAt,
    expiresAt,
    started,
    expired,
  };
};

export const serializeCouponStoreSummary = (coupon: any) => {
  const plain = getPlain(coupon);
  const store = plain?.store;
  const storeId = toFiniteNumber(store?.id ?? plain?.storeId ?? plain?.store_id ?? null);
  if (!storeId) return null;
  return {
    id: storeId,
    name: String(store?.name || "").trim() || `Store #${storeId}`,
    slug: String(store?.slug || "").trim() || null,
    status: String(store?.status || "").trim().toUpperCase() || null,
  };
};

export const serializeAdminCouponGovernance = (coupon: any) => {
  const scope = resolveCouponGovernanceScope(coupon);
  const store = serializeCouponStoreSummary(coupon);
  return {
    scopeType: scope.scopeType,
    storeId: scope.storeId,
    ownership: scope.ownership,
    sellerEditable: scope.scopeType === "STORE",
    adminManaged: true,
    clientVisibleWhenValid: true,
    store,
    notes:
      scope.scopeType === "STORE"
        ? [
            "Store-scoped coupon only applies to the linked store.",
            "Admin can review, disable, or override seller coupons.",
          ]
        : [
            "Platform coupon is owned by admin.",
            "Platform coupon can apply across storefront according to validation rules.",
          ],
  };
};

export const serializePublicCouponScope = (coupon: any) => {
  const scope = resolveCouponGovernanceScope(coupon);
  return {
    scopeType: scope.scopeType,
    storeId: scope.storeId,
  };
};

export const serializePublicCouponSnapshot = (coupon: any) => {
  const plain = getPlain(coupon);
  const scope = serializePublicCouponScope(plain);
  const timeWindow = getCouponTimeWindow(plain);
  return {
    id: toFiniteNumber(plain?.id ?? null),
    code: String(plain?.code || "").trim().toUpperCase(),
    discountType: plain?.discountType === "fixed" ? "fixed" : "percent",
    amount: toFiniteNumber(plain?.amount) ?? 0,
    minSpend: toFiniteNumber(plain?.minSpend) ?? 0,
    scopeType: scope.scopeType,
    startsAt: timeWindow.startsAt,
    expiresAt: timeWindow.expiresAt,
  };
};
