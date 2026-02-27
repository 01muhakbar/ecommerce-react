import { Coupon } from "../models/index.js";

const normalizeCode = (value: any) => String(value || "").trim().toUpperCase();
const toSafeTotal = (subtotal: number, shipping: number, discount: number) =>
  Math.max(0, subtotal + shipping - discount);

export type CouponQuoteReason =
  | "not_found"
  | "inactive"
  | "expired"
  | "minSpend"
  | "invalid_input";

export type CouponQuoteResult = {
  valid: boolean;
  reason?: CouponQuoteReason;
  message?: string;
  code: string | null;
  discount: number;
  discountType: "percent" | "fixed" | null;
  discountValue: number;
  minSpend: number;
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
  return { code, discountType, amount, minSpend };
};

const parseLocaleNumber = (value: any) => {
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

export const quoteCoupon = async (
  codeRaw: any,
  subtotalRaw: any,
  shippingRaw: any = 0
): Promise<CouponQuoteResult> => {
  const code = normalizeCode(codeRaw);
  const subtotal = parseLocaleNumber(subtotalRaw);
  const shipping = parseLocaleNumber(shippingRaw);

  if (!Number.isFinite(subtotal) || subtotal < 0 || !Number.isFinite(shipping) || shipping < 0) {
    return {
      valid: false,
      reason: "invalid_input",
      message: "Subtotal or shipping is invalid.",
      code: code || null,
      discount: 0,
      discountType: null,
      discountValue: 0,
      minSpend: 0,
      expiresAt: null,
      subtotal: Number.isFinite(subtotal) ? Math.max(0, subtotal) : 0,
      shipping: Number.isFinite(shipping) ? Math.max(0, shipping) : 0,
      total: Number.isFinite(subtotal) || Number.isFinite(shipping)
        ? Math.max(0, (Number.isFinite(subtotal) ? subtotal : 0) + (Number.isFinite(shipping) ? shipping : 0))
        : 0,
    };
  }

  const baseTotal = Math.max(0, subtotal + shipping);
  if (!code) {
    return {
      valid: false,
      reason: "not_found",
      message: "Coupon not found",
      code: null,
      discount: 0,
      discountType: null,
      discountValue: 0,
      minSpend: 0,
      expiresAt: null,
      subtotal,
      shipping,
      total: baseTotal,
    };
  }

  const coupon = await Coupon.findOne({ where: { code } });
  if (!coupon) {
    return {
      valid: false,
      reason: "not_found",
      message: "Coupon not found",
      code,
      discount: 0,
      discountType: null,
      discountValue: 0,
      minSpend: 0,
      expiresAt: null,
      subtotal,
      shipping,
      total: baseTotal,
    };
  }

  const { code: resolvedCode, discountType, amount, minSpend } =
    normalizeCouponRecord(coupon);
  const effectiveCode = resolvedCode || code;
  const activeRaw = getCouponField(coupon, ["active", "isActive", "published"]);
  const isActive = Boolean(activeRaw);
  const expiresAtRaw = getCouponField(coupon, ["expiresAt", "expires_at"]) ?? null;
  const parsedExpiry =
    expiresAtRaw != null ? new Date(String(expiresAtRaw)) : null;
  const expiresAt =
    parsedExpiry && !Number.isNaN(parsedExpiry.getTime())
      ? parsedExpiry.toISOString()
      : null;

  if (!isActive) {
    return {
      valid: false,
      reason: "inactive",
      message: "Coupon is inactive",
      code: effectiveCode,
      discount: 0,
      discountType,
      discountValue: amount,
      minSpend,
      expiresAt,
      subtotal,
      shipping,
      total: baseTotal,
    };
  }

  if (parsedExpiry && !Number.isNaN(parsedExpiry.getTime()) && parsedExpiry.getTime() < Date.now()) {
    return {
      valid: false,
      reason: "expired",
      message: "Coupon has expired",
      code: effectiveCode,
      discount: 0,
      discountType,
      discountValue: amount,
      minSpend,
      expiresAt,
      subtotal,
      shipping,
      total: baseTotal,
    };
  }

  if (subtotal < minSpend) {
    return {
      valid: false,
      reason: "minSpend",
      message: "Minimum spend requirement was not met",
      code: effectiveCode,
      discount: 0,
      discountType,
      discountValue: amount,
      minSpend,
      expiresAt,
      subtotal,
      shipping,
      total: baseTotal,
    };
  }

  const discountUnclamped =
    discountType === "percent"
      ? Math.round(subtotal * (amount / 100))
      : Math.min(amount, subtotal);
  const discount = Math.max(0, Math.min(subtotal, discountUnclamped));

  return {
    valid: true,
    code: effectiveCode,
    discount,
    discountType,
    discountValue: amount,
    minSpend,
    expiresAt,
    subtotal,
    shipping,
    total: toSafeTotal(subtotal, shipping, discount),
  };
};

export const validateCoupon = async (codeRaw: any, subtotalRaw: any) => {
  const quoted = await quoteCoupon(codeRaw, subtotalRaw, 0);
  if (!quoted.valid) {
    const defaultMessage = (() => {
      switch (quoted.reason) {
        case "not_found":
          return "Kupon tidak valid.";
        case "inactive":
          return "Kupon sedang nonaktif.";
        case "expired":
          return "Kupon sudah kedaluwarsa.";
        case "minSpend":
          return `Minimal belanja ${quoted.minSpend} untuk memakai kupon ini.`;
        default:
          return "Subtotal tidak valid.";
      }
    })();
    return {
      valid: false,
      code: quoted.code,
      discountAmount: 0,
      reason: quoted.reason,
      message: quoted.message || defaultMessage,
    };
  }

  return {
    valid: true,
    code: quoted.code,
    discountType: quoted.discountType || "percent",
    amount: quoted.discountValue,
    minSpend: quoted.minSpend,
    discountAmount: quoted.discount,
  };
};


