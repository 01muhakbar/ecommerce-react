export function requireAdmin(req, res, next) {
    const role = req.user?.role;
    if (role !== "admin" && role !== "super_admin") {
        return res.status(403).json({ message: "Forbidden: Admin only" });
    }
    next();
}
// Contoh lain untuk dipakai nanti:
export function requireSuperAdmin(req, res, next) {
    const role = req.user?.role;
    if (role === "super_admin")
        return next();
    return res.status(403).json({ message: "Forbidden: Super Admin only" });
}
