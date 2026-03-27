import { Router } from "express";
import { z } from "zod";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import { Coupon, Store } from "../models/index.js";
import { parseLocaleNumber } from "../services/coupon.service.js";
import {
  getCouponTimeWindow,
  serializeCouponStoreSummary,
} from "../services/sharedContracts/couponGovernance.js";

const router = Router();

const parseDateTime = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const couponSchema = z.object({
  code: z.string().trim().min(1).max(255),
  discountType: z.enum(["percent", "fixed"]).default("percent"),
  amount: z
    .union([z.string(), z.number()])
    .transform(parseLocaleNumber)
    .refine((value) => value > 0, { message: "Amount must be greater than 0." }),
  minSpend: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => parseLocaleNumber(value ?? 0))
    .refine((value) => value >= 0, { message: "Min spend must be >= 0." })
    .default(0),
  active: z.coerce.boolean().optional().default(true),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const couponPatchSchema = z.object({
  code: z.string().trim().min(1).max(255).optional(),
  discountType: z.enum(["percent", "fixed"]).optional(),
  amount: z
    .union([z.string(), z.number()])
    .transform(parseLocaleNumber)
    .refine((value) => value > 0, { message: "Amount must be greater than 0." })
    .optional(),
  minSpend: z
    .union([z.string(), z.number()])
    .transform(parseLocaleNumber)
    .refine((value) => value >= 0, { message: "Min spend must be >= 0." })
    .optional(),
  active: z.coerce.boolean().optional(),
  startsAt: z.string().datetime().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

const buildStatusMeta = (coupon: any) => {
  const active = Boolean(coupon?.active);
  const { startsAt, expiresAt, started, expired } = getCouponTimeWindow(coupon);

  if (!active) {
    return {
      code: "INACTIVE",
      label: "Inactive",
      tone: "stone",
      description: "This store coupon is saved but not exposed to public validation.",
      startsAt,
      expiresAt,
    };
  }

  if (!started) {
    return {
      code: "SCHEDULED",
      label: "Scheduled",
      tone: "amber",
      description: "This store coupon is active but its schedule has not started yet.",
      startsAt,
      expiresAt,
    };
  }

  if (expired) {
    return {
      code: "EXPIRED",
      label: "Expired",
      tone: "rose",
      description: "This store coupon is outside its active window and public validation will reject it.",
      startsAt,
      expiresAt,
    };
  }

  return {
    code: "ACTIVE",
    label: "Active",
    tone: "emerald",
    description: "This store coupon is eligible for public validation only inside its own store scope.",
    startsAt,
    expiresAt,
  };
};

const serializeSellerCoupon = (coupon: any, sellerAccess: any) => {
  const plain = coupon?.get ? coupon.get({ plain: true }) : coupon;
  const status = buildStatusMeta(plain);
  const store = serializeCouponStoreSummary(plain) || {
    id: Number(sellerAccess?.store?.id || 0) || null,
    name: String(sellerAccess?.store?.name || ""),
    slug: String(sellerAccess?.store?.slug || ""),
    status: String(sellerAccess?.store?.status || "ACTIVE"),
  };

  return {
    id: Number(plain?.id || 0),
    code: String(plain?.code || "").trim().toUpperCase(),
    discountType: plain?.discountType === "fixed" ? "fixed" : "percent",
    amount: Number(plain?.amount || 0),
    minSpend: Number(plain?.minSpend || 0),
    active: Boolean(plain?.active),
    scopeType: "STORE",
    storeId: Number(plain?.storeId || store?.id || 0) || null,
    startsAt: status.startsAt,
    expiresAt: status.expiresAt,
    status,
    governance: {
      canView: true,
      canEdit: Boolean(sellerAccess?.permissionKeys?.includes("COUPON_EDIT")),
      canManageStatus: Boolean(sellerAccess?.permissionKeys?.includes("COUPON_STATUS_MANAGE")),
      sellerOwned: true,
      adminAuthority:
        "Admin keeps final governance visibility and can still manage seller coupons from the admin coupon lane.",
      storefrontBoundary:
        "Storefront validation remains scope-aware and only accepts this coupon for its linked store.",
    },
    store,
    createdAt: plain?.createdAt || null,
    updatedAt: plain?.updatedAt || null,
  };
};

const validateCouponWindow = (startsAt: Date | null, expiresAt: Date | null) => {
  if (startsAt && expiresAt && expiresAt.getTime() < startsAt.getTime()) {
    const error: any = new Error("Expiry must be after start date.");
    error.statusCode = 400;
    throw error;
  }
};

const findSellerStoreCoupon = async (storeId: number, couponId: number) =>
  Coupon.findOne({
    where: {
      id: couponId,
      scopeType: "STORE",
      storeId,
    },
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "name", "slug", "status"],
        required: false,
      },
    ],
  });

router.get(
  "/stores/:storeId/coupons",
  requireSellerStoreAccess(["COUPON_VIEW"]),
  async (req, res) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const coupons = await Coupon.findAll({
        where: {
          scopeType: "STORE",
          storeId,
        },
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

      return res.json({
        success: true,
        data: {
          items: coupons.map((coupon) => serializeSellerCoupon(coupon, sellerAccess)),
          store: {
            id: Number(sellerAccess?.store?.id || storeId),
            name: String(sellerAccess?.store?.name || ""),
            slug: String(sellerAccess?.store?.slug || ""),
            status: String(sellerAccess?.store?.status || "ACTIVE"),
          },
          governance: {
            lane: "SELLER_STORE_COUPONS",
            scopeType: "STORE",
            sellerCanCreate: Boolean(sellerAccess?.permissionKeys?.includes("COUPON_CREATE")),
            sellerCanEdit: Boolean(sellerAccess?.permissionKeys?.includes("COUPON_EDIT")),
            sellerCanManageStatus: Boolean(
              sellerAccess?.permissionKeys?.includes("COUPON_STATUS_MANAGE")
            ),
            adminAuthority:
              "Admin can still view and manage these seller coupons from the admin coupon lane.",
          },
        },
      });
    } catch (error) {
      console.error("[seller/coupons:list] error", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load seller coupons.",
      });
    }
  }
);

router.post(
  "/stores/:storeId/coupons",
  requireSellerStoreAccess(["COUPON_CREATE"]),
  async (req, res, next) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const body = couponSchema.parse(req.body || {});
      const startsAt = parseDateTime(body.startsAt ?? null);
      const expiresAt = parseDateTime(body.expiresAt ?? null);
      validateCouponWindow(startsAt, expiresAt);

      const created = await Coupon.create({
        code: body.code.trim().toUpperCase(),
        discountType: body.discountType,
        amount: body.amount,
        minSpend: body.minSpend ?? 0,
        active: body.active ?? true,
        startsAt,
        expiresAt,
        scopeType: "STORE",
        storeId,
      } as any);

      const hydrated = await findSellerStoreCoupon(storeId, Number(created.id));

      return res.status(201).json({
        success: true,
        data: serializeSellerCoupon(hydrated || created, sellerAccess),
      });
    } catch (error) {
      if ((error as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Coupon code already exists" });
      }
      const statusCode = (error as any)?.statusCode;
      if (statusCode) {
        return res.status(statusCode).json({ success: false, message: (error as any)?.message });
      }
      return next(error);
    }
  }
);

router.patch(
  "/stores/:storeId/coupons/:couponId",
  requireSellerStoreAccess(["COUPON_EDIT"]),
  async (req, res, next) => {
    try {
      const sellerAccess = (req as any).sellerAccess;
      const storeId = Number(req.params.storeId);
      const couponId = Number(req.params.couponId);
      if (!Number.isFinite(couponId) || couponId <= 0) {
        return res.status(400).json({ success: false, message: "Invalid coupon id." });
      }

      const body = couponPatchSchema.parse(req.body || {});
      const coupon = await findSellerStoreCoupon(storeId, couponId);
      if (!coupon) {
        return res.status(404).json({ success: false, message: "Coupon not found." });
      }

      const startsAt =
        body.startsAt !== undefined ? parseDateTime(body.startsAt) : (coupon as any).get?.("startsAt");
      const expiresAt =
        body.expiresAt !== undefined ? parseDateTime(body.expiresAt) : (coupon as any).get?.("expiresAt");
      validateCouponWindow(startsAt, expiresAt);

      const patch: any = {};
      if (body.code !== undefined) patch.code = body.code.trim().toUpperCase();
      if (body.discountType !== undefined) patch.discountType = body.discountType;
      if (body.amount !== undefined) patch.amount = body.amount;
      if (body.minSpend !== undefined) patch.minSpend = body.minSpend;
      if (body.startsAt !== undefined) patch.startsAt = startsAt;
      if (body.expiresAt !== undefined) patch.expiresAt = expiresAt;
      if (body.active !== undefined) {
        const canManageStatus = Boolean(
          sellerAccess?.permissionKeys?.includes("COUPON_STATUS_MANAGE")
        );
        if (!canManageStatus) {
          return res.status(403).json({
            success: false,
            code: "SELLER_PERMISSION_DENIED",
            message: "You do not have permission to manage coupon status.",
          });
        }
        patch.active = body.active;
      }

      await coupon.update(patch);
      const refreshed = await findSellerStoreCoupon(storeId, couponId);

      return res.json({
        success: true,
        data: serializeSellerCoupon(refreshed || coupon, sellerAccess),
      });
    } catch (error) {
      if ((error as any)?.name === "SequelizeUniqueConstraintError") {
        return res.status(409).json({ success: false, message: "Coupon code already exists" });
      }
      const statusCode = (error as any)?.statusCode;
      if (statusCode) {
        return res.status(statusCode).json({ success: false, message: (error as any)?.message });
      }
      return next(error);
    }
  }
);

export default router;
