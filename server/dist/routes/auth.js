// server/src/routes/auth.ts
import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import * as models from "../models/index.js";
import { loginSchema } from "@ecommerce/schemas";
import requireAuth from "../middleware/requireAuth.js";
const { User } = models;
const AUTH_DEBUG_COOKIES = process.env.AUTH_DEBUG_COOKIES === "true";
const router = Router();
function logSetCookieDebug(res, label) {
    if (!AUTH_DEBUG_COOKIES)
        return;
    try {
        const hdr = res.getHeader?.("Set-Cookie");
        const arr = Array.isArray(hdr) ? hdr : hdr ? [hdr] : [];
        const cookieLines = arr.map((v) => String(v));
        const hasSecure = cookieLines.some((line) => /;\s*secure/i.test(line));
        console.log(`[auth][cookie] ${label} Set-Cookie count=${cookieLines.length} hasSecure=${hasSecure}`);
        const preview = cookieLines.map((line) => line.replace(/^(token|[^=]+)=([^;]+)/i, "$1=<redacted>"));
        console.log(`[auth][cookie] ${label} preview=`, preview);
    }
    catch {
        console.log(`[auth][cookie] ${label} debug failed`);
    }
}
// Health
router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "auth" });
});
router.post("/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "Invalid payload" });
    }
    if (!User) {
        return res.status(500).json({ success: false, message: "User model not loaded" });
    }
    const { email, password } = parsed.data;
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }
        const secret = process.env.JWT_SECRET ?? "dev-secret";
        const expiresIn = (process.env.JWT_EXPIRES_IN ?? "1h");
        const options = { expiresIn };
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role, name: user.name }, secret, options);
        const cookieName = process.env.AUTH_COOKIE_NAME || "token";
        const secure = process.env.COOKIE_SECURE === "true" ||
            (process.env.NODE_ENV === "production" && req.secure);
        res.cookie(cookieName, token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
        });
        logSetCookieDebug(res, "login");
        return res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role,
                },
            },
        });
    }
    catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
});
router.get("/me", requireAuth, (req, res) => {
    const user = req.user;
    if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!User) {
        return res.status(500).json({ success: false, message: "User model not loaded" });
    }
    return User.findByPk(user.id, {
        attributes: ["id", "email", "name", "role"],
    })
        .then((dbUser) => {
        if (!dbUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        return res.json({ success: true, data: { user: dbUser } });
    })
        .catch((error) => {
        console.error(error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    });
});
router.post("/logout", (_req, res) => {
    const cookieName = process.env.AUTH_COOKIE_NAME || "token";
    const secure = process.env.COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
    res.clearCookie(cookieName, {
        httpOnly: true,
        secure,
        sameSite: "lax",
        path: "/",
    });
    return res.json({ success: true });
});
router.post("/admin/login", async (req, res) => {
    const { email, password } = req.body;
    if (!User) {
        return res.status(500).json({ message: "User model not loaded" });
    }
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
        const secret = process.env.JWT_SECRET ?? "your-secret-key";
        const options = { expiresIn: "1h" };
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, options);
        const cookieName = process.env.AUTH_COOKIE_NAME || "token";
        const secure = process.env.COOKIE_SECURE === "true" ||
            (process.env.NODE_ENV === "production" && req.secure);
        res.cookie(cookieName, token, {
            httpOnly: true,
            secure,
            sameSite: "lax",
            path: "/",
        });
        logSetCookieDebug(res, "admin_login");
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
router.post("/admin/logout", (_req, res) => {
    const name = process.env.AUTH_COOKIE_NAME || "token";
    res.clearCookie(name, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });
    res.status(204).end();
});
export default router;
