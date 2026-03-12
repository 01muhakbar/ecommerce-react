import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";
import requireAuth from "../middleware/requireAuth.js";
import { resolveSellerAccessBySlug } from "../services/seller/resolveSellerAccess.js";

const router = Router();

const serializeSellerWorkspaceContext = (sellerAccess: any) => ({
  store: {
    id: Number(sellerAccess.store.id),
    name: String(sellerAccess.store.name || ""),
    slug: String(sellerAccess.store.slug || ""),
    status: String(sellerAccess.store.status || "ACTIVE"),
  },
  access: {
    accessMode: sellerAccess.accessMode,
    roleCode: sellerAccess.roleCode,
    permissionKeys: sellerAccess.permissionKeys,
    membershipStatus: sellerAccess.membershipStatus,
    isOwner: Boolean(sellerAccess.isOwner),
    memberId: sellerAccess.memberId,
  },
});

router.get("/stores/:storeId/context", requireSellerStoreAccess(), async (req, res) => {
  const sellerAccess = (req as any).sellerAccess;

  return res.json({
    success: true,
    data: serializeSellerWorkspaceContext(sellerAccess),
  });
});

router.get("/stores/slug/:storeSlug/context", async (req, res, next) => {
  requireAuth(req, res, async () => {
    try {
      const result = await resolveSellerAccessBySlug({
        storeSlug: String(req.params.storeSlug || ""),
        userId: Number((req as any).user?.id),
      });

      if (!result.ok) {
        return res.status(result.status).json({
          success: false,
          code: result.code,
          message: result.message,
        });
      }

      return res.json({
        success: true,
        data: serializeSellerWorkspaceContext(result.data),
      });
    } catch (error) {
      return next(error);
    }
  });
});

export default router;
