import { Router } from "express";
import { Op } from "sequelize";
import { Product, StoreAuditLog } from "../models/index.js";
import { resolveAuthenticatedUserFromToken } from "../services/authSession.service.js";
import {
  listProductActivity,
  PRODUCT_ACTIVITY_LOG_ACTIONS,
} from "../services/productActivityLog.service.js";
import { hasRole } from "../utils/rbac.js";
import {
  resolveSellerAccess,
  sellerHasPermission,
} from "../services/seller/resolveSellerAccess.js";

const router = Router();

const getStorefrontCookieName = () => process.env.AUTH_COOKIE_NAME || "token";
const getAdminCookieName = () =>
  process.env.ADMIN_AUTH_COOKIE_NAME || `${getStorefrontCookieName()}_admin`;

const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeText = (value: unknown) => String(value || "").trim();

const parseOptionalProductActivityStoreId = (logs: any[], productId: number) => {
  for (const log of logs) {
    const states = [log?.afterState, log?.beforeState];
    for (const value of states) {
      if (!value || typeof value !== "string") continue;
      try {
        const parsed = JSON.parse(value);
        const snapshot = parsed?.snapshot ?? parsed;
        const entityId = asNumber(snapshot?.entityId ?? parsed?.entityId, 0);
        if (entityId !== productId) continue;
        const storeId = asNumber(snapshot?.storeId ?? parsed?.storeId, 0);
        if (storeId > 0) return storeId;
      } catch {
        // ignore malformed audit state
      }
    }
  }
  return null;
};

const resolveProductActivityActor = async (req: any) => {
  const cookies = req.cookies || {};
  const adminToken = cookies[getAdminCookieName()];
  if (adminToken) {
    try {
      const session = await resolveAuthenticatedUserFromToken(String(adminToken));
      if (session?.authUser?.id) {
        req.user = session.authUser;
        return session.authUser;
      }
    } catch {
      // fall through to storefront/session fallback
    }
  }

  if (req.user?.id) {
    return req.user;
  }

  const candidateTokens = [cookies[getStorefrontCookieName()]].filter(Boolean);

  for (const token of candidateTokens) {
    try {
      const session = await resolveAuthenticatedUserFromToken(String(token));
      if (session?.authUser?.id) {
        req.user = session.authUser;
        return session.authUser;
      }
    } catch {
      // try next token
    }
  }

  return null;
};

router.get("/:productId/activity", async (req, res, next) => {
  try {
    const actor = await resolveProductActivityActor(req as any);
    if (!actor?.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const productId = asNumber(req.params.productId, 0);
    if (!productId) {
      return res.status(400).json({ success: false, message: "Invalid product id." });
    }

    const limit = Math.max(1, Math.min(100, asNumber(req.query.limit, 20)));
    const offset = Math.max(0, asNumber(req.query.offset, 0));
    const isAdminActor = hasRole(actor.role, "staff");

    const product = await Product.findByPk(productId, {
      attributes: ["storeId"],
    });
    let storeId = asNumber(product?.get?.("storeId"), 0) || null;

    if (!storeId) {
      const logs = await StoreAuditLog.findAll({
        where: {
          action: {
            [Op.in]: Object.values(PRODUCT_ACTIVITY_LOG_ACTIONS),
          },
        } as any,
        order: [["createdAt", "DESC"]],
      }).catch(() => []);
      storeId = parseOptionalProductActivityStoreId(logs, productId);
    }

    if (!storeId) {
      return res.status(404).json({ success: false, message: "Product activity not found." });
    }

    if (!isAdminActor) {
      const access = await resolveSellerAccess({
        storeId,
        userId: Number(actor.id),
      });

      if (!access.ok) {
        return res.status(access.status).json({
          success: false,
          code: access.code,
          message: access.message,
        });
      }

      if (!sellerHasPermission(access.data, "PRODUCT_VIEW")) {
        return res.status(403).json({
          success: false,
          code: "SELLER_PERMISSION_DENIED",
          message: "You do not have permission to view product activity.",
        });
      }
    }

    const result = await listProductActivity({
      storeId,
      productId,
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        items: result.items,
        pagination: {
          limit,
          offset,
          total: result.total,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
