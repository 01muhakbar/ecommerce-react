import { Op } from "sequelize";
import { Coupon } from "../models/index.js";
const normalizeCode = (value) => String(value || "").trim().toUpperCase();
const parseAmount = (value) => {
    const parsed = Number.parseFloat(String(value ?? 0));
    return Number.isFinite(parsed) ? parsed : 0;
};
export const validateCoupon = async (codeRaw, subtotalRaw) => {
    const code = normalizeCode(codeRaw);
    const subtotal = parseAmount(subtotalRaw);
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
    const minSpend = parseAmount(coupon.minSpend || 0);
    if (subtotal < minSpend) {
        return {
            valid: false,
            code,
            discountAmount: 0,
            message: `Minimal belanja ${minSpend} untuk memakai kupon ini.`,
        };
    }
    const amount = parseAmount(coupon.amount || 0);
    let discountAmount = 0;
    if (coupon.discountType === "percent") {
        discountAmount = (subtotal * amount) / 100;
    }
    else {
        discountAmount = amount;
    }
    discountAmount = Math.max(0, Math.min(subtotal, discountAmount));
    return {
        valid: true,
        code,
        discountType: coupon.discountType,
        amount,
        minSpend,
        discountAmount,
    };
};
