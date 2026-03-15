import { Router } from "express";
import requireAuth from "../middleware/requireAuth.js";
import { loadOrderWithSplitRelations, serializeSplitOrder } from "./checkout.js";
import { expireOverduePaymentsForOrder } from "../services/paymentExpiry.service.js";

const router = Router();

const getAuthUser = (req: any) => {
  const userId = Number(req?.user?.id);
  return {
    id: Number.isFinite(userId) ? userId : null,
    role: String(req?.user?.role || "").toLowerCase().trim(),
  };
};

const isAdminRole = (role: string) =>
  role === "admin" || role === "super_admin" || role === "staff";

router.use(requireAuth);

router.get("/:orderId/checkout-payment", async (req, res) => {
  try {
    const authUser = getAuthUser(req);
    if (!authUser.id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const lookup = String(req.params.orderId || "").trim();
    if (!lookup) {
      return res.status(400).json({
        success: false,
        message: "Invalid order id.",
      });
    }

    const order = await loadOrderWithSplitRelations(lookup);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    const orderUserId = Number(order.get?.("userId") ?? (order as any).userId ?? 0);
    if (orderUserId !== authUser.id && !isAdminRole(authUser.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this order.",
      });
    }

    const expired = await expireOverduePaymentsForOrder(Number(order.get?.("id") ?? (order as any).id ?? 0));
    const resolvedOrder = expired ? await loadOrderWithSplitRelations(lookup) : order;

    return res.json({
      success: true,
      data: serializeSplitOrder(resolvedOrder),
    });
  } catch (error) {
    console.error("[orders/checkout-payment] error", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load checkout payment view.",
    });
  }
});

export default router;
