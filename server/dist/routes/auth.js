import { Router } from "express";
const router = Router();
// Healthcheck minimal
router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "auth" });
});
// Opsional: profil dummy agar FE tidak error saat fetch /me
router.get("/me", (_req, res) => {
    res.json({ id: "0", email: "admin@local", role: "super_admin" });
});
export default router;
