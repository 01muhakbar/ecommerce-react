// server/src/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { authFromCookie } from "./middleware/authFromCookie.js"; // ⬅️ tambahkan
import { requireAdmin } from "./middleware/requireRole.js";
import authRouter from "./routes/auth.js";
import catalogRouter from "./routes/admin.catalog.js";
import statsRouter from "./routes/admin.stats.js";
import analyticsRouter from "./routes/admin.analytics.js";
const app = express();
// body & cookie
app.use(cookieParser());
app.use(express.json());
// CORS (pakai kredensial/kuki)
const ORIGIN = process.env.CLIENT_URL || process.env.CORS_ORIGIN;
if (ORIGIN) {
    app.use(cors({ origin: ORIGIN, credentials: true }));
}
// ⬅️ pasang pengisian req.user dari cookie JWT
app.use(authFromCookie);
// public
app.use("/api/auth", authRouter);
// protected
app.use("/api/admin/catalog", requireAdmin, catalogRouter);
app.use("/api/admin/stats", requireAdmin, statsRouter);
app.use("/api/admin/analytics", requireAdmin, analyticsRouter);
export default app;
