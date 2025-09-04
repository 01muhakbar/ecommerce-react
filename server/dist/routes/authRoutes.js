"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const authController = __importStar(require("../controllers/authController"));
const authMiddleware_1 = require("../middleware/authMiddleware"); // Import protect and restrictTo
const validators_1 = require("../middleware/validators");
const validate_1 = __importDefault(require("../middleware/validate"));
const schemas_1 = require("@ecommerce/schemas");
const router = express_1.default.Router();
// --- User Auth ---
router.post("/register", validators_1.validateRegister, authController.register);
router.post("/login", validators_1.validateLogin, authController.login);
router.post("/logout", authController.logout);
// --- User Password Management ---
router.post("/forgot-password", authController.forgotPassword);
router
    .route("/reset-password/:token")
    .get((req, res) => {
    // Menyajikan halaman statis untuk form reset password
    res.sendFile(path_1.default.join(__dirname, "..", "..", "public", "reset-password.html"));
})
    .patch(authController.resetPassword);
// --- Admin Auth & Password ---
router.post("/admin/login", (0, validate_1.default)(schemas_1.loginAdminSchema), authController.loginAdmin);
router.post("/admin/forgot-password", (0, validate_1.default)(schemas_1.forgotPasswordAdminSchema), authController.forgotPasswordAdmin);
router.post("/admin/reset-password/:token", (0, validate_1.default)(schemas_1.resetPasswordAdminSchema), authController.resetPasswordAdmin);
router.post("/admin/logout", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)("admin"), authController.logoutAdmin);
exports.default = router;
