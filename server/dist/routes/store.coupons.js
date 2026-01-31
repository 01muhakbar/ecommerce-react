import { Router } from "express";
import { validateCoupon } from "../services/coupon.service.js";
import { Coupon } from "../models/index.js";
import { Op } from "sequelize";
const router = Router();
const parseAmount = (value) => {
    const parsed = Number.parseFloat(String(value ?? 0));
    return Number.isFinite(parsed) ? parsed : 0;
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
                amount: parseAmount(coupon.amount || 0),
                minSpend: parseAmount(coupon.minSpend || 0),
                expiresAt: coupon.expiresAt ?? null,
            })),
        });
    }
    catch (error) {
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
        const subtotalNumber = parseAmount(subtotal);
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
        return res.json({
            success: true,
            data: {
                valid: true,
                code: result.code,
                discountType: result.discountType,
                amount: result.amount,
                minSpend: result.minSpend,
                discountAmount: result.discountAmount,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
export default router;
