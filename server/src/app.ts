// server/src/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";

import { requireAdmin } from "./middleware/requireRole.js";

// hanya import router yang BARU/kanonik:
import authRouter from "./routes/auth.js";
import catalogRouter from "./routes/admin.catalog.js";
import statsRouter from "./routes/admin.stats.js";
import analyticsRouter from "./routes/admin.analytics.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

const ORIGIN = process.env.CLIENT_URL || process.env.CORS_ORIGIN;
if (ORIGIN) {
  app.use(cors({ origin: ORIGIN, credentials: true }));
}

// public
app.use("/api/auth", authRouter);

// protected (kanonik)
app.use("/api/admin/catalog", requireAdmin, catalogRouter);
app.use("/api/admin/stats", requireAdmin, statsRouter);
app.use("/api/admin/analytics", requireAdmin, analyticsRouter);

export default app;
