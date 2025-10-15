// server/src/routes/admin.analytics.ts
import { Router } from "express";
const router = Router();

router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "analytics" });
});

export default router;
