// server/src/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import authFromCookie from "./middleware/authFromCookie.js";
import { requireAdmin } from "./middleware/requireRole.js";

import authRouter from "./routes/auth.js";
import catalogRouter from "./routes/admin.catalog.js";
import statsRouter from "./routes/admin.stats.js";
import analyticsRouter from "./routes/admin.analytics.js";
import staffRouter from "./routes/admin.staff.js";
import adminProductsRouter from "./routes/admin.products.js";
import adminCategoriesRouter from "./routes/admin.categories.js";

const app = express();

app.use(cookieParser());
app.use(express.json());

const ORIGIN = process.env.CLIENT_URL || process.env.CORS_ORIGIN;
if (ORIGIN) {
  app.use(cors({ origin: ORIGIN, credentials: true }));
}

app.use(authFromCookie);

// public
app.use("/api/auth", authRouter);
// serve uploaded files (products, staff, etc.)
app.use("/uploads", express.static(path.resolve(process.cwd(), "server/uploads")));

// protected
app.use("/api/admin/catalog", requireAdmin, catalogRouter);
app.use("/api/admin/stats", requireAdmin, statsRouter);
app.use("/api/admin/analytics", requireAdmin, analyticsRouter);
app.use("/api/admin/staff", requireAdmin, staffRouter);
app.use("/api/admin/products", requireAdmin, adminProductsRouter);
app.use("/api/admin/categories", requireAdmin, adminCategoriesRouter);

export default app;
