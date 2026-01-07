// server/src/routes/auth.ts
import { Router } from "express";
import { User } from "../models/index.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
const router = Router();
// Health
router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "auth" });
});
// Dummy /me (sementara, ganti dengan real)
router.get("/me", (_req, res) => {
    res.json({ id: "0", email: "admin@local", role: "super_admin" });
});
router.post("/admin/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || "your-secret-key", { expiresIn: "1h" });
        res.cookie("access_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
        });
        res.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
            },
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
});
// ⬇️ Tambahan: logout admin - hapus cookie JWT
router.post("/admin/logout", (req, res) => {
    // ganti 'token' jika nama cookie JWT kamu berbeda
    // clear the same cookie name used in login
    res.clearCookie("access_token", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });
    return res.status(204).end();
});
export default router;
