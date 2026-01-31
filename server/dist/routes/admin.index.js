import { Router } from "express";
import adminCategoriesRouter from "./admin.categories.js";
import adminStaffRouter from "./admin.staff.js";
import adminStatsRouter from "./admin.stats.js";
import adminAnalyticsRouter from "./admin.analytics.js";
import adminProductsRouter from "./admin.products.js";
import customersRouter from "./admin.customers.js";
import ordersRouter from "./admin.orders.js";
import settingsRouter from "./admin.settings.js";
import adminUploadsRouter from "./admin.uploads.js";
const router = Router();
// Rute `/catalog` ini ambigu dan menyebabkan konflik dengan `/products`.
// Kita akan menonaktifkannya dan menggunakan `/products` secara langsung.
// router.use("/catalog", adminCatalogRouter); // JANGAN DIGUNAKAN
router.use("/categories", adminCategoriesRouter);
router.use("/products", adminProductsRouter);
router.use("/staff", adminStaffRouter);
router.use("/stats", adminStatsRouter);
router.use("/dashboard", adminStatsRouter);
router.use("/analytics", adminAnalyticsRouter);
router.use("/customers", customersRouter);
router.use("/orders", ordersRouter);
router.use("/settings", settingsRouter);
router.use("/", adminUploadsRouter);
export default router;
