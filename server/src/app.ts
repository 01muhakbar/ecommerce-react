// server/src/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import authFromCookie from "./middleware/authFromCookie.js";
import requireAuth from "./middleware/requireAuth.js";
import {
  requireAdmin,
  requireStaffOrAdmin,
  requireSuperAdmin,
} from "./middleware/requireRole.js";

import authRouter from "./routes/auth.js";
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
import storeRouter from "./routes/store.js";
import storeCouponsRouter from "./routes/store.coupons.js";
import publicRouter from "./routes/public.js";
import healthRouter from "./routes/health.js";

const app = express();
// If behind a reverse proxy (nginx/vercel), allow req.secure via X-Forwarded-Proto
app.set("trust proxy", 1);

app.use(cookieParser());
app.use(express.json());

const ORIGIN =
  process.env.CLIENT_URL || process.env.CORS_ORIGIN || "http://localhost:5173";
app.use(cors({ origin: ORIGIN, credentials: true }));

// optional: boleh tetap dipakai, tapi pastikan tidak konflik dengan requireAuth
app.use(authFromCookie);

app.use("/api", healthRouter);

// public
app.use("/api", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/store", storeRouter);
app.use("/api/store/coupons", storeCouponsRouter);

// serve uploaded files
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// protected baseline
app.use("/api/admin", requireAuth);

// admin routes (matrix)
app.use("/api/admin/catalog", requireAdmin, catalogRouter);
app.use("/api/admin/stats", requireStaffOrAdmin, statsRouter);
app.use("/api/admin/analytics", requireStaffOrAdmin, analyticsRouter);

app.use("/api/admin/products", requireStaffOrAdmin, adminProductsRouter);
app.use("/api/admin/orders", requireStaffOrAdmin, adminOrdersRouter);
app.use("/api/admin/customers", requireStaffOrAdmin, adminCustomersRouter);

app.use("/api/admin/categories", requireAdmin, adminCategoriesRouter);
app.use("/api/admin/coupons", requireAdmin, adminCouponsRouter);

// super admin only
app.use("/api/admin/staff", requireSuperAdmin, staffRouter);

// uploads (tentukan kebijakan; ini aku set staff+)
app.use("/api/admin", requireStaffOrAdmin, adminUploadsRouter);

// 404 handler (dev-only logging)
app.use((req, res) => {
  if (process.env.NODE_ENV === "development") {
    console.log("[404]", req.method, req.originalUrl);
  }
  res.status(404).json({ success: false, message: "Not found" });
});

export default app;
