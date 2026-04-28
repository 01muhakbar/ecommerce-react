import { Coupon } from "../models/index.js";
import {
  getCouponTimeWindow,
  normalizeCouponScopeType,
  resolveCouponGovernanceScope,
} from "./sharedContracts/couponGovernance.js";

const normalizeCode = (value: any) => String(value || "").trim().toUpperCase();
const toSafeTotal = (subtotal: number, shipping: number, discount: number) =>
  Math.max(0, subtotal + shipping - discount);

export type CouponQuoteReason =
  | "not_found"
  | "inactive"
  | "not_started"
  | "expired"
  | "minSpend"
  | "invalid_input"
  | "scope_required"
  | "scope_mismatch";

export type CouponScopeContext = {
  storeId?: any;
  storeIds?: any[];
};

export type CouponQuoteResult = {
  valid: boolean;
  reason?: CouponQuoteReason;
  message?: string;
  couponId: number | null;
  code: string | null;
  discount: number;
  discountType: "percent" | "fixed" | null;
  discountValue: number;
  minSpend: number;
  scopeType: "PLATFORM" | "STORE" | null;
  storeId: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  subtotal: number;
  shipping: number;
  total: number;
};

const getCouponField = (coupon: any, keys: string[]) => {
  if (!coupon) return undefined;
  const raw =
    typeof coupon.get === "function" ? coupon.get({ plain: true }) : coupon;
  for (const key of keys) {
    const value = raw?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return undefined;
};

const resolveDiscountType = (value: any): "percent" | "fixed" => {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "fixed" ? "fixed" : "percent";
};

export const parseLocaleNumber = (value: any) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value == null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/(rp|idr)/gi, "")
    .replace(/\s+/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else if (hasDot) {
    const isThousands = /^\d{1,3}(\.\d{3})+$/.test(cleaned);
    if (isThousands) {
      normalized = cleaned.replace(/\./g, "");
    }
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

export const parseCouponInteger = (value: any) => {
  const numeric = parseLocaleNumber(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
};

const normalizeStoreIds = (context?: CouponScopeContext) => {
  const rawValues = [
    ...(Array.isArray(context?.storeIds) ? context!.storeIds : []),
    context?.storeId,
  ];
  return Array.from(
    new Set(
      rawValues
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    )
  );
};

export const normalizeCouponRecord = (coupon: any) => {
  const code = normalizeCode(getCouponField(coupon, ["code", "couponCode", "coupon_code"]));
  const discountType = resolveDiscountType(
    getCouponField(coupon, ["discountType", "discount_type", "type"])
  );
  const amount = parseLocaleNumber(
    getCouponField(coupon, [
      "amount",
      "discountAmount",
      "discount_amount",
      "discount",
      "value",
      "discountValue",
      "discount_value",
    ]) ?? 0
  );
  const amountInteger = parseCouponInteger(amount);
  const minSpend = parseLocaleNumber(
    getCouponField(coupon, [
      "minSpend",
      "min_spend",
      "minimumSpend",
      "minimum_spend",
      "minAmount",
      "min_amount",
      "minimumAmount",
      "minimum_amount",
    ]) ?? 0
  );
  const minSpendInteger = parseCouponInteger(minSpend);
  const storeIdRaw = getCouponField(coupon, ["storeId", "store_id"]);
  const storeId = Number.isFinite(Number(storeIdRaw)) ? Number(storeIdRaw) : null;
  const scopeType = normalizeCouponScopeType(
    getCouponField(coupon, ["scopeType", "scope_type"]) ?? (storeId ? "STORE" : "PLATFORM")
  );
  const startsAtRaw = getCouponField(coupon, ["startsAt", "starts_at"]) ?? null;
  const expiresAtRaw = getCouponField(coupon, ["expiresAt", "expires_at"]) ?? null;
  const startsAtParsed = startsAtRaw != null ? new Date(String(startsAtRaw)) : null;
  const expiresAtParsed = expiresAtRaw != null ? new Date(String(expiresAtRaw)) : null;
  return {
    code,
    discountType,
    amount: amountInteger,
    minSpend: minSpendInteger,
    scopeType,
    storeId: scopeType === "STORE" ? storeId : null,
    startsAt:
      startsAtParsed && !Number.isNaN(startsAtParsed.getTime())
        ? startsAtParsed.toISOString()
        : null,
    expiresAt:
      expiresAtParsed && !Number.isNaN(expiresAtParsed.getTime())
        ? expiresAtParsed.toISOString()
        : null,
  };
};

const buildBaseQuote = (
  code: string | null,
  subtotal: number,
  shipping: number,
  overrides: Partial<CouponQuoteResult> = {}
): CouponQuoteResult => ({
  valid: false,
  couponId: null,
  code,
  discount: 0,
  discountType: null,
  discountValue: 0,
  minSpend: 0,
  scopeType: null,
  storeId: null,
  startsAt: null,
  expiresAt: null,
  subtotal,
  shipping,
  total: Math.max(0, subtotal + shipping),
  ...overrides,
});

const resolveScopeFailure = (
  coupon: any,
  effectiveCode: string,
  couponId: number | null,
  subtotal: number,
  shipping: number,
  discountType: "percent" | "fixed",
  amount: number,
  minSpend: number,
  normalizedStoreIds: number[]
): CouponQuoteResult | null => {
  const { scopeType, storeId } = resolveCouponGovernanceScope(coupon);
  const { startsAt, expiresAt } = getCouponTimeWindow(coupon);
  if (scopeType !== "STORE") return null;
  if (normalizedStoreIds.length === 0) {
    return buildBaseQuote(effectiveCode, subtotal, shipping, {
      reason: "scope_required",
      message: "Coupon is only valid for its linked store.",
      couponId,
      discountType,
      discountValue: amount,
      minSpend,
      scopeType,
      storeId,
      startsAt,
      expiresAt,
    });
  }
  if (normalizedStoreIds.length !== 1 || normalizedStoreIds[0] !== storeId) {
    return buildBaseQuote(effectiveCode, subtotal, shipping, {
      reason: "scope_mismatch",
      message: "Coupon does not match the store in this checkout.",
      couponId,
      discountType,
      discountValue: amount,
      minSpend,
      scopeType,
      storeId,
      startsAt,
      expiresAt,
    });
  }
  return null;
};

export const quoteCoupon = async (
  codeRaw: any,
  subtotalRaw: any,
  shippingRaw: any = 0,
  context?: CouponScopeContext
): Promise<CouponQuoteResult> => {
  const code = normalizeCode(codeRaw);
  const subtotal = parseLocaleNumber(subtotalRaw);
  const shipping = parseLocaleNumber(shippingRaw);

  if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(shipping) || shipping < 0) {
    return buildBaseQuote(code || null, Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0, Number.isFinite(shipping) ? Math.max(0, shipping) : 0, {
      reason: "invalid_input",
      message: "Subtotal or shipping is invalid.",
    });
  }

  const baseTotal = Math.max(0, subtotal + shipping);
  if (!code) {
    return buildBaseQuote(null, subtotal, shipping, {
      reason: "not_found",
      message: "Coupon not found",
      total: baseTotal,
    });
  }

  const coupon = await Coupon.findOne({ where: { code } });
  if (!coupon) {
    return buildBaseQuote(code, subtotal, shipping, {
      reason: "not_found",
      message: "Coupon not found",
      total: baseTotal,
    });
  }

  const normalizedStoreIds = normalizeStoreIds(context);
  const couponIdRaw = getCouponField(coupon, ["id"]);
  const couponId = Number.isFinite(Number(couponIdRaw)) ? Number(couponIdRaw) : null;
  const { code: resolvedCode, discountType, amount, minSpend, scopeType, storeId, startsAt, expiresAt } =
    normalizeCouponRecord(coupon);
  const effectiveCode = resolvedCode || code;
  const activeRaw = getCouponField(coupon, ["active", "isActive", "published"]);
  const isActive = Boolean(activeRaw);
  const timeWindow = getCouponTimeWindow(coupon);

  if (!isActive) {
    return buildBaseQuote(effectiveCode, subtotal, shipping, {
      reason: "inactive",
      message: "Coupon is inactive",
      couponId,
      discountType,
      discountValue: amount,
      minSpend,
      scopeType,
      storeId,
      startsAt,
      expiresAt,
      total: baseTotal,
    });
  }

  if (!timeWindow.started) {
    return buildBaseQuote(effectiveCode, subtotal, shipping, {
      reason: "not_started",
      message: "Coupon is not active yet",
      couponId,
      discountType,
      discountValue: amount,
      minSpend,
      scopeType,
      storeId,
      startsAt,
      expiresAt,
      total: baseTotal,
    });
  }

  if (timeWindow.expired) {
    return buildBaseQuote(effectiveCode, subtotal, shipping, {
      reason: "expired",
      message: "Coupon has expired",
      couponId,
      discountType,
      discountValue: amount,
      minSpend,
      scopeType,
      storeId,
      startsAt,
      expiresAt,
      total: baseTotal,
    });
  }

  const scopeFailure = resolveScopeFailure(
    coupon,
    effectiveCode,
    couponId,
    subtotal,
    shipping,
    discountType,
    amount,
    minSpend,
    normalizedStoreIds
  );
  if (scopeFailure) {
    return scopeFailure;
  }

  if (subtotal < minSpend) {
    return buildBaseQuote(effectiveCode, subtotal, shipping, {
      reason: "minSpend",
      message: "Minimum spend requirement was not met",
      couponId,
      discountType,
      discountValue: amount,
      minSpend,
      scopeType,
      storeId,
      startsAt,
      expiresAt,
      total: baseTotal,
    });
  }

  const discountUnclamped =
    discountType === "percent"
      ? Math.round(subtotal * (amount / 100))
      : Math.min(amount, subtotal);
  const discount = Math.max(0, Math.min(subtotal, discountUnclamped));

  return {
    valid: true,
    couponId,
    code: effectiveCode,
    discount,
    discountType,
    discountValue: amount,
    minSpend,
    scopeType,
    storeId,
    startsAt,
    expiresAt,
    subtotal,
    shipping,
    total: toSafeTotal(subtotal, shipping, discount),
  };
};

export const validateCoupon = async (
  codeRaw: any,
  subtotalRaw: any,
  context?: CouponScopeContext
) => {
  const quoted = await quoteCoupon(codeRaw, subtotalRaw, 0, context);
  if (!quoted.valid) {
    const defaultMessage = (() => {
      switch (quoted.reason) {
        case "not_found":
          return "Kupon tidak valid.";
        case "inactive":
          return "Kupon sedang nonaktif.";
        case "not_started":
          return "Kupon belum aktif.";
        case "expired":
          return "Kupon sudah kedaluwarsa.";
        case "minSpend":
          return `Minimal belanja ${quoted.minSpend} untuk memakai kupon ini.`;
        case "scope_required":
          return "Kupon ini hanya berlaku untuk toko tertentu.";
        case "scope_mismatch":
          return "Kupon ini tidak berlaku untuk toko pada checkout ini.";
        default:
          return "Subtotal tidak valid.";
      }
    })();
    return {
      valid: false,
      couponId: quoted.couponId,
      code: quoted.code,
      discountAmount: 0,
      reason: quoted.reason,
      message: quoted.message || defaultMessage,
      scopeType: quoted.scopeType,
      storeId: quoted.storeId,
    };
  }

  return {
    valid: true,
    couponId: quoted.couponId,
    code: quoted.code,
    discountType: quoted.discountType || "percent",
    amount: quoted.discountValue,
    minSpend: quoted.minSpend,
    discountAmount: quoted.discount,
    scopeType: quoted.scopeType,
    storeId: quoted.storeId,
  };
};
