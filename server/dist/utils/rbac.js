import requireAuth from "../middleware/requireAuth.js";
const ROLE_RANK = {
    staff: 1,
    admin: 2,
    super_admin: 3,
};
function getRole(req) {
    const role = String(req.user?.role || "").toLowerCase();
    return ROLE_RANK[role] ? role : null;
}
export function hasRole(userRole, requiredRole) {
    const role = String(userRole || "").toLowerCase();
    const userRank = ROLE_RANK[role] || 0;
    const requiredRank = ROLE_RANK[requiredRole] || 0;
    return userRank >= requiredRank;
}
export function requireMinRole(minRole) {
    return (req, res, next) => {
        requireAuth(req, res, () => {
            const role = getRole(req);
            if (!role) {
                return res.status(401).json({ message: "Unauthorized" });
            }
            if (!hasRole(role, minRole)) {
                return res.status(403).json({ message: "Forbidden" });
            }
            return next();
        });
    };
}
export const requireStaffOrAdmin = requireMinRole("staff");
export const requireAdmin = requireMinRole("admin");
export const requireSuperAdmin = requireMinRole("super_admin");
