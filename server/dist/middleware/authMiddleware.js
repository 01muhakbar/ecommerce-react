import jwt from "jsonwebtoken";
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";
export const protect = (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token)
        return res.sendStatus(401);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = payload;
        return next();
    }
    catch {
        return res.sendStatus(401);
    }
};
export const restrictTo = (...roles) => {
    return (req, res, next) => {
        const userRole = (req.user?.role || '').toLowerCase();
        const allowed = roles.map(r => r.toLowerCase());
        if (!allowed.includes(userRole)) {
            return res.status(403).json({
                status: 'fail',
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};
