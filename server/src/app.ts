// server/src/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import fs from "fs";
import path from "path";

import authFromCookie from "./middleware/authFromCookie.js";
import requireAuth from "./middleware/requireAuth.js";
import {
  requireAdmin,
  requireStaffOrAdmin,
  requireSuperAdmin,
} from "./middleware/requireRole.js";

import authRouter from "./routes/auth.js";
import cartRouter from "./routes/cartRoutes.js";
import checkoutRouter from "./routes/checkout.js";
import ordersRouter from "./routes/orders.js";
import paymentsRouter from "./routes/payments.js";
import sellerPaymentsRouter from "./routes/seller.payments.js";
import sellerOrdersRouter from "./routes/seller.orders.js";
import sellerPaymentProfilesRouter from "./routes/seller.paymentProfiles.js";
import sellerProductsRouter from "./routes/seller.products.js";
import sellerStoreProfileRouter from "./routes/seller.storeProfile.js";
import sellerTeamRouter from "./routes/seller.team.js";
import sellerWorkspaceRouter from "./routes/seller.workspace.js";
import sellerCouponsRouter from "./routes/seller.coupons.js";
import sellerNotificationsRouter from "./routes/seller.notifications.js";
import userStoreApplicationsRouter from "./routes/user.storeApplications.js";
import catalogRouter from "./routes/admin.catalog.js";
import statsRouter from "./routes/admin.stats.js";
import analyticsRouter from "./routes/admin.analytics.js";
import staffRouter from "./routes/admin.staff.js";
import adminProductsRouter from "./routes/admin.products.js";
import adminUploadsRouter from "./routes/admin.uploads.js";
import adminCategoriesRouter from "./routes/admin.categories.js";
import adminOrdersRouter from "./routes/admin.orders.js";
import adminCustomersRouter from "./routes/admin.customers.js";
import adminCouponsRouter from "./routes/admin.coupons.js";
import adminAttributesRouter from "./routes/admin.attributes.js";
import adminAttributeValuesRouter from "./routes/admin.attributeValues.js";
import adminProductAttributesRouter from "./routes/admin.productAttributes.js";
import adminSettingsRouter from "./routes/admin.settings.js";
import adminLanguagesRouter from "./routes/admin.languages.js";
import adminCurrenciesRouter from "./routes/admin.currencies.js";
import adminStoreCustomizationRouter from "./routes/admin.storeCustomization.js";
import adminStoreProfilesRouter from "./routes/admin.storeProfiles.js";
import adminStoreSettingsRouter from "./routes/admin.storeSettings.js";
import adminNotificationsRouter from "./routes/admin.notifications.js";
import adminStorePaymentProfilesRouter from "./routes/admin.storePaymentProfiles.js";
import adminStoreApplicationsRouter from "./routes/admin.storeApplications.js";
import adminPaymentsAuditRouter from "./routes/admin.payments.audit.js";
import storeRouter from "./routes/store.js";
import storesRouter from "./routes/stores.js";
import storeCouponsRouter from "./routes/store.coupons.js";
import storeCustomizationRouter from "./routes/store.customization.js";
import storeSettingsRouter from "./routes/store.settings.js";
import stripeWebhookRouter from "./routes/store.stripeWebhook.js";
import publicRouter from "./routes/public.js";
import healthRouter from "./routes/health.js";

const app = express();
// If behind a reverse proxy (nginx/vercel), allow req.secure via X-Forwarded-Proto
app.set("trust proxy", 1);

app.use(cookieParser());
app.use("/api/store", stripeWebhookRouter);
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
  "http://localhost:5173",
].filter((origin): origin is string => Boolean(origin));
const corsOrigin: string | string[] =
  allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins;
app.use(cors({ origin: corsOrigin, credentials: true }));

// optional: boleh tetap dipakai, tapi pastikan tidak konflik dengan requireAuth
app.use(authFromCookie);

app.use("/api", healthRouter);

// public
app.use("/api", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/cart", cartRouter);
app.use("/api/checkout", checkoutRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/seller", sellerPaymentsRouter);
app.use("/api/seller", sellerOrdersRouter);
app.use("/api/seller", sellerPaymentProfilesRouter);
app.use("/api/seller", sellerProductsRouter);
app.use("/api/seller", sellerStoreProfileRouter);
app.use("/api/seller", sellerTeamRouter);
app.use("/api/seller", sellerWorkspaceRouter);
app.use("/api/seller", sellerCouponsRouter);
app.use("/api/seller", sellerNotificationsRouter);
app.use("/api/store", storeRouter);
app.use("/api/stores", storesRouter);
app.use("/api/store/coupons", storeCouponsRouter);
app.use("/api/store/customization", storeCustomizationRouter);
app.use("/api/store/settings", storeSettingsRouter);
app.use("/api/user", userStoreApplicationsRouter);

// serve uploaded files from all known locations (priority: runtime uploads first)
const uploadsCandidates = [
  path.resolve(process.cwd(), "uploads"),
  path.resolve(process.cwd(), "public/uploads"),
  path.resolve(process.cwd(), "server/public/uploads"),
];
uploadsCandidates.forEach((uploadsDir) => {
  if (!fs.existsSync(uploadsDir)) return;
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      setHeaders: (res) => {
        res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
      },
    })
  );
});

// protected baseline
app.use("/api/admin", requireAuth);

// admin routes (matrix)
app.use("/api/admin/catalog", requireAdmin, catalogRouter);
app.use("/api/admin/stats", requireStaffOrAdmin, statsRouter);
app.use("/api/admin/analytics", requireStaffOrAdmin, analyticsRouter);

app.use("/api/admin/products", requireStaffOrAdmin, adminProductsRouter);
app.use("/api/admin/orders", requireStaffOrAdmin, adminOrdersRouter);
app.use("/api/admin/customers", requireStaffOrAdmin, adminCustomersRouter);
app.use("/api/admin/notifications", requireStaffOrAdmin, adminNotificationsRouter);
app.use("/api/admin/payments/audit", requireStaffOrAdmin, adminPaymentsAuditRouter);

app.use("/api/admin/categories", requireAdmin, adminCategoriesRouter);
app.use("/api/admin/coupons", requireAdmin, adminCouponsRouter);
app.use("/api/admin/attributes", requireAdmin, adminAttributesRouter);
app.use("/api/admin/settings", requireAdmin, adminSettingsRouter);
app.use("/api/admin/languages", requireAdmin, adminLanguagesRouter);
app.use("/api/admin/currencies", requireAdmin, adminCurrenciesRouter);
app.use(
  "/api/admin/store/customization",
  requireAdmin,
  adminStoreCustomizationRouter
);
app.use("/api/admin", requireAdmin, adminStoreProfilesRouter);
app.use("/api/admin/store/settings", requireAdmin, adminStoreSettingsRouter);
app.use("/api/admin/stores", requireAdmin, adminStorePaymentProfilesRouter);
app.use("/api/admin", requireAdmin, adminStoreApplicationsRouter);
app.use("/api/admin", requireAdmin, adminAttributeValuesRouter);
app.use("/api/admin", requireAdmin, adminProductAttributesRouter);

// super admin only
app.use("/api/admin/staff", requireSuperAdmin, staffRouter);

// uploads (tentukan kebijakan; ini aku set staff+)
app.use("/api/admin", requireStaffOrAdmin, adminUploadsRouter);

app.use((error: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (error?.type === "entity.too.large" || error?.status === 413) {
    return res.status(413).json({
      success: false,
      message: "Request payload is too large. Please upload a smaller image.",
    });
  }
  return next(error);
});

// 404 handler (dev-only logging)
app.use((req, res) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[404]", req.method, req.originalUrl);
  }
  res.status(404).json({ success: false, message: "Not found" });
});

export default app;
