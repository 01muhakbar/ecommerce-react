import jwt from "jsonwebtoken";
export const protect = (req, res, next) => {
    console.log("Cookies received by protect middleware:", req.cookies);
    const token = req.cookies?.token;
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
