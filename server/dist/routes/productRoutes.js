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
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const productController = __importStar(require("../controllers/productController"));
const validate_1 = __importDefault(require("../middleware/validate"));
const schemas_1 = require("@ecommerce/schemas");
const router = express_1.default.Router();
// Konfigurasi Multer untuk penyimpanan file
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/images/products");
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + "-" + uniqueSuffix + path_1.default.extname(file.originalname));
    },
});
const upload = (0, multer_1.default)({ storage: storage });
// --- RUTE PRODUK ---
router.get("/", productController.getAllProducts);
router.get("/:id", productController.getProductById);
router.get("/:id/preview", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)("admin", "penjual"), productController.getProductDetailsForPreview);
// Rute untuk membuat produk baru
router.post("/", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)("penjual", "admin"), upload.fields([
    { name: "productImages", maxCount: 9 },
    { name: "promoProductImage", maxCount: 1 },
    { name: "productVideo", maxCount: 1 },
]), (0, validate_1.default)(schemas_1.createProductSchema), // Pindahkan validasi ke sini setelah multer
productController.createProduct);
// Rute untuk menghapus produk
router.delete("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)("admin"), productController.deleteProduct);
// Rute untuk memperbarui produk
router.put("/:id", authMiddleware_1.protect, (0, authMiddleware_1.restrictTo)("admin", "penjual"), productController.updateProduct);
exports.default = router;
