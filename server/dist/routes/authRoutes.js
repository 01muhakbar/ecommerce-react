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
const authController = __importStar(require("../controllers/authController"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
// Rute untuk registrasi user baru
router.post("/register", authController.register);
// Rute untuk login user
router.post("/login", authController.login);
// Rute untuk logout user
router.post("/logout", authController.logout);
// --- Rute untuk Manajemen Password ---
// Rute untuk meminta reset password (mengirim email ke pengguna)
router.post("/forgot-password", authController.forgotPassword);
// Rute untuk melakukan reset password dengan token yang valid
router.patch("/reset-password/:token", authController.resetPassword);
// Rute untuk menampilkan halaman reset password (file statis)
router.get("/reset-password/:token", (req, res) => {
    // Path disesuaikan untuk bekerja dari lokasi file saat ini
    res.sendFile(path_1.default.join(__dirname, "..", "..", "public", "reset-password.html"));
});
exports.default = router;
