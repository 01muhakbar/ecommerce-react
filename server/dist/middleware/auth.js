"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRole = exports.isAuth = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// --- MIDDLEWARE ---
/**
 * Middleware untuk memverifikasi token JWT.
 */
const isAuth = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
        token = req.headers.authorization.split(" ")[1];
    }
    else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    if (!token) {
        res.status(401).json({ message: "Authentication token is required." });
        return;
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || '', (err, decoded) => {
        if (err) {
            res.status(401).json({ message: "Invalid or expired token." });
            return;
        }
        req.user = decoded;
        next();
    });
};
exports.isAuth = isAuth;
/**
 * Middleware untuk memverifikasi peran user.
 */
const hasRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(403).json({ message: "Forbidden: User not authenticated." });
            return;
        }
        if (roles.includes(req.user.role)) {
            next();
            return;
        }
        res.status(403).json({
            message: "Forbidden: You do not have the required role to access this resource.",
        });
    };
};
exports.hasRole = hasRole;
