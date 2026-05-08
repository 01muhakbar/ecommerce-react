import type { Request, Response, NextFunction } from "express";
import requireAuth from "./requireAuth.js";
import {
  resolveSellerAccess,
  sellerHasPermission,
} from "../services/seller/resolveSellerAccess.js";

type SellerRequest = Request & {
  sellerAccess?: any;
};

export default function requireSellerStoreAccess(requiredPermissions: string[] = []) {
  return (req: Request, res: Response, next: NextFunction) => {
    requireAuth(req, res, async () => {
      try {
        const result = await resolveSellerAccess({
          storeId: Number(req.params.storeId),
          userId: Number((req as any).user?.id),
        });

        if (!result.ok) {
          return res.status(result.status).json({
            success: false,
            code: result.code,
            message: result.message,
          });
        }

        const missingPermissions = requiredPermissions.filter(
          (permission) => !sellerHasPermission(result.data, permission)
        );

        if (missingPermissions.length > 0) {
          return res.status(403).json({
            success: false,
            code: "SELLER_PERMISSION_DENIED",
            message: "You do not have permission to perform this action.",
          });
        }

        (req as SellerRequest).sellerAccess = result.data;
        return next();
      } catch (error) {
        return next(error);
      }
    });
  };
}
