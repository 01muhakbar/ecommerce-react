"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const adminOrderController_1 = require("../controllers/adminOrderController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Base path is /api/v1/admin/orders, so these routes are relative to that
router.get('/', authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)('admin'), adminOrderController_1.getOrders);
router.put('/:id/status', authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)('admin'), adminOrderController_1.updateOrderStatus);
exports.default = router;
