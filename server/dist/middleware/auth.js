import jwt from "jsonwebtoken";
function normalize(v) {
    return String(v || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ");
}
/**
 * Membaca cookie "access_token", verifikasi JWT, dan isi req.user
 * Dev helper: jika ALLOW_HEADER_ROLE=true dan ada header x-test-role, gunakan itu untuk inject role (hanya dev)
 */
export function attachUserFromAuth(req, _res, next) {
    try {
        const allowHeaderRole = process.env.ALLOW_HEADER_ROLE === "true";
        const testRole = req.get("x-test-role");
        if (allowHeaderRole && testRole) {
            req.user = {
                id: "dev-user",
                email: "dev@example.com",
                role: normalize(testRole),
            };
            return next();
        }
        const token = req.cookies?.access_token;
        if (!token)
            return next(); // tidak 401 di sini—biarkan guard yang mengurus
        const secret = process.env.JWT_SECRET || "dev-secret";
        const payload = jwt.verify(token, secret);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: normalize(payload.role),
        };
        return next();
    }
    catch (err) {
        // token invalid/expired → anggap tidak login
        return next();
    }
}
