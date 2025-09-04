"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const validate = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body);
        next();
    }
    catch (error) {
        if (error instanceof zod_1.ZodError) {
            const formattedErrors = error.issues.map((err) => ({
                message: err.message,
                path: err.path,
            }));
            return res.status(400).json({ errors: formattedErrors });
        }
        // Handle non-Zod errors
        return res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.default = validate;
