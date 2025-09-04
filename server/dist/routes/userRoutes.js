"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authController_1 = require("../controllers/authController");
const userController_1 = require("../controllers/userController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validators_1 = require("../middleware/validators");
const router = express_1.default.Router();
router.post("/register", validators_1.validateRegister, authController_1.register);
router.post("/login", validators_1.validateLogin, authController_1.login);
router.get("/logout", authController_1.logout);
router.use(authMiddleware_1.protect); // Middleware untuk melindungi rute di bawah ini
router.get("/me", userController_1.getMe);
router.patch("/updateMe", validators_1.validateUpdateProfile, userController_1.updateMe);
exports.default = router;
