"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.restrictTo = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const index_1 = require("../models/index");
// --- MIDDLEWARE ---
/**
 * Middleware untuk melindungi rute dengan memeriksa JWT yang valid.
 * Menangani request API dan navigasi browser.
 */
const protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        else if (req.cookies.jwt) {
            token = req.cookies.jwt;
        }
        const isApiRequest = req.originalUrl.startsWith('/api');
        if (!token || token === "loggedout") {
            const message = 'You are not logged in. Please log in to get access.';
            if (isApiRequest) {
                res.status(401).json({ status: 'fail', message });
            }
            else {
                res.redirect("/login");
            }
            return;
        }
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT_SECRET is not defined in the environment variables');
        }
        // Use synchronous jwt.verify which throws an error on failure, caught by the outer catch block
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const currentUser = await index_1.User.findByPk(decoded.id);
        if (!currentUser) {
            const message = 'The user belonging to this token does no longer exist.';
            if (isApiRequest) {
                res.status(401).json({ status: 'fail', message });
            }
            else {
                res.clearCookie("jwt");
                res.redirect("/login");
            }
            return;
        }
        if (!currentUser.isActive) {
            const message = 'Your account has been deactivated. Please contact support.';
            if (isApiRequest) {
                res.status(403).json({ status: 'fail', message });
            }
            else {
                res.clearCookie("jwt");
                res.redirect("/login?message=account_deactivated");
            }
            return;
        }
        req.user = currentUser;
        next();
    }
    catch (error) {
        const isApiRequest = req.originalUrl.startsWith('/api');
        const message = 'Invalid or expired token. Please log in again.';
        if (isApiRequest) {
            res.status(401).json({ status: 'fail', message });
        }
        else {
            res.redirect("/login");
        }
    }
};
exports.protect = protect;
/**
 * Middleware untuk membatasi akses ke peran (role) tertentu.
 */
const restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403).send('<h1>403 - Forbidden</h1><p>Anda tidak memiliki izin untuk mengakses halaman ini.</p>');
            return;
        }
        next();
    };
};
exports.restrictTo = restrictTo;
