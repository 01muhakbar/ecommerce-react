import { Router } from "express";
import adminCategoriesRouter from "./admin.categories";
import adminStaffRouter from "./admin.staff";
import adminStatsRouter from "./admin.stats";
import adminAnalyticsRouter from "./admin.analytics";
import adminProductsRouter from "./admin.products";
import customersRouter from "./admin.customers";
import ordersRouter from "./admin.orders";
import settingsRouter from "./admin.settings";

const router = Router();

// Rute `/catalog` ini ambigu dan menyebabkan konflik dengan `/products`.
// Kita akan menonaktifkannya dan menggunakan `/products` secara langsung.
// router.use("/catalog", adminCatalogRouter); // JANGAN DIGUNAKAN
router.use("/categories", adminCategoriesRouter);
router.use("/products", adminProductsRouter);
router.use("/staff", adminStaffRouter);
router.use("/stats", adminStatsRouter);
router.use("/analytics", adminAnalyticsRouter);
router.use("/customers", customersRouter);
router.use("/orders", ordersRouter);
router.use("/settings", settingsRouter);

export default router;