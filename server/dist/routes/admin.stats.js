// server/src/routes/admin.stats.ts
import { Router } from "express";
const router = Router();
router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "stats" });
});
export default router;
