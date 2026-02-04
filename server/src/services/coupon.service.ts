import { Op } from "sequelize";
import { Coupon } from "../models/index.js";

const normalizeCode = (value: any) => String(value || "").trim().toUpperCase();

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

export const validateCoupon = async (codeRaw: any, subtotalRaw: any) => {
  const code = normalizeCode(codeRaw);
  const subtotal = parseLocaleNumber(subtotalRaw);

  if (!code) {
    return {
      valid: false,
      code: null,
      discountAmount: 0,
      message: "Kode kupon kosong.",
    };
  }

  if (!Number.isFinite(subtotal) || subtotal < 0) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      message: "Subtotal tidak valid.",
    };
  }

  const now = new Date();
  const coupon = await Coupon.findOne({
    where: {
      code,
      active: true,
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gte]: now } }],
    },
  });

  if (!coupon) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      message: "Kupon tidak valid.",
    };
  }

  const minSpend = parseLocaleNumber(coupon.minSpend || 0);
  if (subtotal < minSpend) {
    return {
      valid: false,
      code,
      discountAmount: 0,
      message: `Minimal belanja ${minSpend} untuk memakai kupon ini.`,
    };
  }

  const amount = parseLocaleNumber(coupon.amount || 0);
  let discountAmount = 0;
  if (coupon.discountType === "percent") {
    discountAmount = Math.floor(subtotal * (amount / 100));
  } else {
    discountAmount = Math.min(subtotal, amount);
  }

  discountAmount = Math.max(0, Math.min(subtotal, discountAmount));

  if (process.env.NODE_ENV !== "production") {
    console.log("[coupon.validate] raw", {
      amount: coupon.amount,
      minSpend: coupon.minSpend,
      amountType: typeof coupon.amount,
      minSpendType: typeof coupon.minSpend,
    });
    console.log("[coupon.validate] parsed", {
      subtotal,
      amount,
      minSpend,
      discountAmount,
    });
  }

  return {
    valid: true,
    code,
    discountType: coupon.discountType,
    amount,
    minSpend,
    discountAmount,
  };
};


