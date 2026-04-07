import { Router } from "express";
import { Op } from "sequelize";
import {
  quoteCoupon,
  validateCoupon,
} from "../services/coupon.service.js";
import { serializePublicCouponSnapshot } from "../services/sharedContracts/couponGovernance.js";
import { Coupon, Store } from "../models/index.js";

const router = Router();

const normalizeStoreSlug = (value: any) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");

const resolveStoreScopeId = async (rawStoreId: any, rawStoreSlug: any) => {
  const storeId = Number(rawStoreId);
  if (Number.isFinite(storeId) && storeId > 0) {
    const store = await Store.findByPk(storeId, {
      attributes: ["id", "slug", "status"],
    });
    return store ? Number((store as any).id) : null;
  }

  const storeSlug = normalizeStoreSlug(rawStoreSlug);
  if (!storeSlug) return null;
  const store = await Store.findOne({
    where: { slug: storeSlug } as any,
    attributes: ["id", "slug", "status"],
  });
  return store ? Number((store as any).id) : null;
};

const buildActiveWindowWhere = (now: Date) => ({
  active: true,
  [Op.and]: [
    {
      [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }],
    },
    {
      [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gte]: now } }],
    },
  ],
});

// GET /api/store/coupons
router.get("/", async (req, res, next) => {
  try {
    const now = new Date();
    const scopedStoreId = await resolveStoreScopeId(req.query.storeId, req.query.storeSlug);
    const where: any = {
      ...buildActiveWindowWhere(now),
      [Op.or]:
        scopedStoreId && scopedStoreId > 0
          ? [{ scopeType: "PLATFORM" }, { scopeType: "STORE", storeId: scopedStoreId }]
          : [{ scopeType: "PLATFORM" }, { scopeType: null, storeId: null }],
    };
    const coupons = await Coupon.findAll({
      where,
      include: [
        {
          model: Store,
          as: "store",
          attributes: ["id", "name", "slug", "status"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json({
      data: coupons.map((coupon) => serializePublicCouponSnapshot(coupon)),
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
    const scopedStoreId = await resolveStoreScopeId(req.body?.storeId, req.body?.storeSlug);

    const quoted = await quoteCoupon(code, subtotal, shipping, {
      storeId: scopedStoreId,
    });
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
    const scopedStoreId = await resolveStoreScopeId(req.body?.storeId, req.body?.storeSlug);

    if (typeof code !== "string" || code.trim() === "") {
      return res.status(400).json({ success: false, message: "Coupon code is required." });
    }

    const quoted = await quoteCoupon(code, subtotal, 0, {
      storeId: scopedStoreId,
    });
    if (!quoted.valid && quoted.reason === "invalid_input") {
      return res.status(400).json({ success: false, message: "Subtotal must be a number." });
    }
    const result = await validateCoupon(code, subtotal, {
      storeId: scopedStoreId,
    });
    if (!result.valid) {
      return res.json({
        success: true,
        data: {
          valid: false,
          code: result.code,
          discountAmount: 0,
          scopeType: result.scopeType,
          storeId: result.storeId,
          message: result.message,
        },
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
        scopeType: result.scopeType,
        storeId: result.storeId,
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
