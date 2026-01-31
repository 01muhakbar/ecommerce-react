import jwt from "jsonwebtoken";
// Canonical auth cookie name via AUTH_COOKIE_NAME.
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";
function normalizeRole(input) {
    const raw = String(input ?? "").toLowerCase().trim();
    if (!raw)
        return null;
    const snake = raw.replace(/[^a-z0-9]+/g, "_");
    if (["super_admin", "super-admin", "super admin", "superadmin"].includes(raw) || snake === "super_admin") {
        return "super_admin";
    }
    if (["admin", "administrator"].includes(raw) || snake === "admin") {
        return "admin";
    }
    if (["staf", "staff"].includes(raw) || snake === "staf" || snake === "staff") {
        return "staff";
    }
    return snake;
}
export default function authFromCookie(req, _res, next) {
    try {
        const token = req.cookies?.[COOKIE_NAME] ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : undefined);
        req.user = null;
        if (token) {
            const payload = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
            const rawRole = payload.role || payload.userRole || payload["https://example.com/role"];
            const role = normalizeRole(rawRole);
            req.user = {
                id: payload.id ?? payload.userId ?? payload.sub,
                email: payload.email,
                name: payload.name,
                role,
            };
        }
    }
    catch {
        req.user = null;
    }
    next();
}
