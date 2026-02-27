import { Router } from "express";
import {
  normalizeCouponRecord,
  quoteCoupon,
  validateCoupon,
} from "../services/coupon.service.js";
import { Coupon } from "../models/index.js";
import { Op } from "sequelize";

const router = Router();

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
      data: coupons.map((coupon) => {
        const normalized = normalizeCouponRecord(coupon);
        return {
          id: coupon.id,
          code: normalized.code || coupon.code,
          discountType: normalized.discountType || coupon.discountType,
          amount: normalized.amount,
          minSpend: normalized.minSpend,
          expiresAt: coupon.expiresAt ?? null,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/store/coupons/quote
router.post("/quote", async (req, res, next) => {
  try {
    const code = req.body?.code;
    const subtotal = req.body?.subtotal;
    const shipping = req.body?.shipping ?? 0;

    const quoted = await quoteCoupon(code, subtotal, shipping);
    if (!quoted.valid && quoted.reason === "invalid_input") {
      return res.status(400).json(quoted);
    }

    return res.json(quoted);
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

    const quoted = await quoteCoupon(code, subtotal, 0);
    if (!quoted.valid && quoted.reason === "invalid_input") {
      return res.status(400).json({ success: false, message: "Subtotal must be a number." });
    }
    const result = await validateCoupon(code, subtotal);
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


