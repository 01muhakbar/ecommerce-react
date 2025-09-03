"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.logout = exports.login = exports.register = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const models_1 = require("../models"); // Assuming models/index.ts exports User
const emailService_1 = __importDefault(require("../services/emailService"));
const sequelize_1 = require("sequelize");
// Helper function untuk menandatangani (sign) JWT
const signToken = (id, role) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables');
    }
    if (typeof secret !== 'string') {
        throw new Error('JWT_SECRET must be a string');
    }
    return jsonwebtoken_1.default.sign({ id, role }, secret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '90d',
    });
};
// Helper function untuk membuat token, mengatur cookie, dan mengirim respons
const createAndSendToken = (user, statusCode, res) => {
    const token = signToken(user.id, user.role);
    const cookieExpiresInDays = parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '90', 10);
    const cookieOptions = {
        expires: new Date(Date.now() + cookieExpiresInDays * 24 * 60 * 60 * 1000),
        httpOnly: true,
        path: '/',
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production',
    };
    res.cookie('jwt', token, cookieOptions);
    user.password = undefined; // Hapus password dari output
    res.status(statusCode).json({
        status: 'success',
        data: {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        },
    });
};
const register = async (req, res, next) => {
    try {
        const { name, email, password, role } = req.body;
        if (!name || !email || !password) {
            res.status(400).json({ status: 'fail', message: 'Nama, email, dan password harus diisi.' });
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
        const newUser = await models_1.User.create({
            name,
            email,
            password: hashedPassword,
            role: role || 'pembeli',
        });
        createAndSendToken(newUser, 201, res);
    }
    catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            res.status(400).json({ status: 'fail', message: 'Email sudah terdaftar.' });
            return;
        }
        console.error("REGISTER ERROR:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.register = register;
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ status: 'fail', message: 'Email dan password harus diisi.' });
            return;
        }
        const user = await models_1.User.findOne({ where: { email } });
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            res.status(401).json({ status: 'fail', message: 'Email atau password salah.' });
            return;
        }
        createAndSendToken(user, 200, res);
    }
    catch (error) {
        console.error("LOGIN ERROR:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.login = login;
const logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ status: 'success', message: 'Logged out successfully' });
};
exports.logout = logout;
const forgotPassword = async (req, res, next) => {
    try {
        const user = await models_1.User.findOne({ where: { email: req.body.email } });
        if (!user) {
            res.status(404).json({ status: 'fail', message: 'Tidak ada pengguna dengan alamat email tersebut.' });
            return;
        }
        const resetToken = user.createPasswordResetToken(); // Assuming User model has this method
        await user.save({ validate: false });
        const resetURL = `${req.protocol}://${req.get('host')}/reset-password.html?token=${resetToken}`;
        const message = `Anda menerima email ini karena Anda (atau orang lain) telah meminta reset password untuk akun Anda.

Silakan klik tautan ini untuk mereset password Anda: ${resetURL}

Jika Anda tidak meminta ini, abaikan email ini dan password Anda akan tetap sama.`;
        try {
            await (0, emailService_1.default)({ email: user.email, subject: 'Reset Kata Sandi Anda', message });
            res.status(200).json({ status: 'success', message: 'Token reset password telah dikirim ke email Anda.' });
        }
        catch (emailError) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save({ validate: false });
            console.error("EMAIL SENDING ERROR:", emailError);
            res.status(500).json({ status: 'error', message: emailError.message });
        }
    }
    catch (error) {
        console.error("FORGOT PASSWORD ERROR:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res, next) => {
    try {
        const hashedToken = crypto_1.default.createHash('sha256').update(req.params.token).digest('hex');
        const user = await models_1.User.findOne({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: { [sequelize_1.Op.gt]: Date.now() } // Check if token is still valid
            },
        });
        if (!user) {
            res.status(400).json({ status: 'fail', message: 'Token tidak valid atau sudah kedaluwarsa.' });
            return;
        }
        user.password = req.body.password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save(); // Save the updated user
        createAndSendToken(user, 200, res);
    }
    catch (error) {
        console.error("RESET PASSWORD ERROR:", error);
        res.status(500).json({ status: 'error', message: error.message });
    }
};
exports.resetPassword = resetPassword;
