import { Router } from "express";
import requireSellerStoreAccess from "../middleware/requireSellerStoreAccess.js";

const router = Router();

router.get("/stores/:storeId/context", requireSellerStoreAccess(), async (req, res) => {
  const sellerAccess = (req as any).sellerAccess;

  return res.json({
    success: true,
    data: {
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
    },
  });
});

export default router;
