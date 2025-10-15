import jwt from "jsonwebtoken";
function normalizeRole(input) {
    const raw = String(input ?? "").toLowerCase().trim();
    if (!raw)
        return null;
    // ubah spasi, hyphen, dll menjadi underscore
    const snake = raw.replace(/[^a-z0-9]+/g, "_");
    // pemetaan eksplisit untuk keamanan
    if (["super_admin", "super-admin", "super admin"].includes(raw) || snake === "super_admin") {
        return "super_admin";
    }
    if (["admin", "administrator"].includes(raw) || snake === "admin") {
        return "admin";
    }
    return snake; // fallback
}
export function authFromCookie(req, _res, next) {
    const token = req.cookies?.access_token; // prefer utama
    req.user = null;
    if (!token)
        return next();
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded && typeof decoded === "object") {
            const payload = decoded;
            const rawRole = payload.role ?? payload.user?.role ?? payload.claims?.role;
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
