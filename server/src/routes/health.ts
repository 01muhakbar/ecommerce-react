import { Router } from "express";
import sequelize from "../config/database.js";

const router = Router();

router.get("/health", async (_req, res) => {
  const uptime = Math.floor(process.uptime());
  let db: "connected" | "disconnected" = "disconnected";

  try {
    await sequelize.authenticate();
    db = "connected";
  } catch {
    db = "disconnected";
  }

  res.json({
    ok: true,
    uptime,
    db,
    timestamp: new Date().toISOString(),
  });
});

router.get("/diagnostics/request-context", (req, res) => {
  const request = req as typeof req & {
    requestId?: string;
    correlationId?: string;
    requestIdSource?: "x-request-id" | "x-correlation-id" | "generated";
  };

  res.json({
    ok: true,
    requestId: request.requestId || null,
    correlationId: request.correlationId || null,
    requestIdSource: request.requestIdSource || null,
    responseHeaders: {
      requestId: "X-Request-Id",
      correlationId: "X-Correlation-Id",
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
