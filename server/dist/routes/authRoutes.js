// server/src/routes/auth.ts
import { Router } from "express";
const router = Router();
// Router minimal untuk menenangkan compiler & smoke test
router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "auth" });
});
export default router;
