"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginValidation = exports.resetPasswordValidation = exports.registerValidation = exports.handleValidationErrors = void 0;
const express_validator_1 = require("express-validator");
// Middleware untuk menangani hasil dari rantai validasi
const handleValidationErrors = (req, res, next) => {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
exports.handleValidationErrors = handleValidationErrors;
exports.registerValidation = [
    (0, express_validator_1.body)('name').notEmpty().withMessage('Nama tidak boleh kosong.'),
    (0, express_validator_1.body)('email').isEmail().withMessage('Format email tidak valid.'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password minimal harus 6 karakter.'),
    exports.handleValidationErrors,
];
exports.resetPasswordValidation = [
    (0, express_validator_1.body)('token').notEmpty().withMessage('Token tidak boleh kosong.'),
    (0, express_validator_1.body)('password')
        .isLength({ min: 6 })
        .withMessage('Password baru minimal harus 6 karakter.'),
    exports.handleValidationErrors,
];
exports.loginValidation = [
    (0, express_validator_1.body)('email').isEmail().withMessage('Format email tidak valid.'),
    (0, express_validator_1.body)('password').notEmpty().withMessage('Password tidak boleh kosong.'),
    exports.handleValidationErrors,
];
