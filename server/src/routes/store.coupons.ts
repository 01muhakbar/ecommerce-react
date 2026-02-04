import { Router } from "express";
import { validateCoupon } from "../services/coupon.service.js";
import { Coupon } from "../models/index.js";
import { Op } from "sequelize";

const router = Router();

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

// GET /api/store/coupons
router.get("/", async (_req, res, next) => {
  try {
    const now = new Date();
    const coupons = await Coupon.findAll({
      where: {
        active: true,
        [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gte]: now } }],
      },
      order: [["createdAt", "DESC"]],
    });

    res.json({
      data: coupons.map((coupon) => ({
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        amount: parseLocaleNumber(coupon.amount || 0),
        minSpend: parseLocaleNumber(coupon.minSpend || 0),
        expiresAt: coupon.expiresAt ?? null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/store/coupons/validate
router.post("/validate", async (req, res, next) => {
  try {
    const code = req.body?.code;
    const subtotal = req.body?.subtotal;

    if (typeof code !== "string" || code.trim() === "") {
      return res.status(400).json({ success: false, message: "Coupon code is required." });
    }

    const subtotalNumber = parseLocaleNumber(subtotal);
    if (!Number.isFinite(subtotalNumber) || subtotalNumber < 0) {
      return res.status(400).json({ success: false, message: "Subtotal must be a number." });
    }

    const result = await validateCoupon(code, subtotalNumber);
    if (!result.valid) {
      return res.json({
        success: true,
        data: { valid: false, code: result.code, discountAmount: 0, message: result.message },
      });
    }

    const payload = {
      success: true,
      data: {
        valid: true,
        code: result.code,
        discountType: result.discountType,
        amount: result.amount,
        minSpend: result.minSpend,
        discountAmount: result.discountAmount,
      },
    };
    if (process.env.NODE_ENV !== "production") {
      console.log("[store/coupons/validate] result", payload.data);
    }
    return res.json(payload);
  } catch (error) {
    next(error);
  }
});

export default router;


