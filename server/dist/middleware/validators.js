"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateUpdateProfile = exports.validateRegister = exports.validateLogin = exports.validate = void 0;
const zod_1 = require("zod");
const schemas_1 = require("@ecommerce/schemas");
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            return res.status(400).json({ errors: error.issues });
        }
        next(error);
    }
};
exports.validate = validate;
// Ekspor validator spesifik untuk digunakan di rute
exports.validateLogin = (0, exports.validate)(schemas_1.loginSchema);
exports.validateRegister = (0, exports.validate)(schemas_1.registerSchema);
exports.validateUpdateProfile = (0, exports.validate)(schemas_1.updateProfileSchema);
