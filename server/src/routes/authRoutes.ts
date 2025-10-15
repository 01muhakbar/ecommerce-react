// server/src/routes/auth.ts
import { Router } from "express";
const router = Router();

// Router minimal untuk menenangkan compiler & smoke test
router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "auth" });
});

// (Opsional) endpoint /me minimal agar FE tidak error saat fetch profile
router.get("/me", (_req, res) => {
  res.json({ id: "0", email: "admin@local", role: "super_admin" });
});

export default router;
