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
const userController = __importStar(require("../controllers/userController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Semua rute di bawah ini memerlukan login (dilindungi oleh middleware protect)
router.use(authMiddleware_1.protect);
// Rute untuk pengguna yang sedang login
router.get("/me", userController.getUserProfile);
router.patch("/me", userController.updateMyProfile);
router.patch("/become-seller", userController.becomeSeller);
// --- RUTE KHUSUS ADMIN ---
// Middleware di bawah ini memastikan hanya admin yang bisa mengakses rute selanjutnya
router.use((0, authMiddleware_1.restrictTo)("admin"));
// Rute untuk manajemen umum pengguna oleh admin
router.route('/')
    .get(userController.getAllUsers)
    .post(userController.createUser);
// Rute untuk mendapatkan daftar penjual (untuk filter, dll.)
// router.get("/sellers", userController.getAllSellers); // This is handled by getAllUsers with query param
// Rute untuk manajemen pengguna spesifik (berdasarkan ID)
router.route('/:id')
    .get(userController.getUserById)
    .patch(userController.updateUser)
    .delete(userController.deleteUser);
// Rute tambahan untuk admin
// router.get("/:id/details", userController.getUserDetailsForPreview); // This is handled by getUserById
// router.patch("/:id/status", userController.updateUserStatus); // This is covered by the general updateUser route now
exports.default = router;
