"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config"); // Muat environment variables
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const cors_1 = __importDefault(require("cors"));
const method_override_1 = __importDefault(require("method-override"));
// Impor semua rute yang sudah di-TypeScript-kan
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const cartRoutes_1 = __importDefault(require("./routes/cartRoutes"));
const sellerRoutes_1 = __importDefault(require("./routes/sellerRoutes"));
const categoryRoutes_1 = __importDefault(require("./routes/categoryRoutes"));
const categoryAdminRoutes_1 = __importDefault(require("./routes/categoryAdminRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const admin_1 = __importDefault(require("./routes/admin"));
// Impor model dan middleware
const models_1 = __importDefault(require("./models"));
const errorMiddleware_1 = __importDefault(require("./middleware/errorMiddleware"));
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// Middleware
app.use(express_1.default.json()); // Untuk parsing application/json
app.use(express_1.default.urlencoded({ extended: true })); // Untuk parsing application/x-www-form-urlencoded
app.use((0, method_override_1.default)('_method')); // Untuk mendukung PUT/DELETE dari form HTML
app.use((0, cookie_parser_1.default)()); // Untuk mem-parsing cookie
app.use((0, cors_1.default)()); // Aktifkan CORS untuk semua rute
// --- Rute API --- (Semua rute sekarang adalah API)
// Rute utama API v1
app.use("/api/v1/users", userRoutes_1.default);
app.use("/api/v1/auth", authRoutes_1.default);
app.use("/api/v1/products", productRoutes_1.default);
app.use("/api/v1/cart", cartRoutes_1.default);
app.use("/api/v1/sellers", sellerRoutes_1.default);
app.use("/api/v1/categories", categoryRoutes_1.default);
app.use("/api/v1/admin/categories", categoryAdminRoutes_1.default);
app.use("/api/v1/orders", orderRoutes_1.default);
app.use("/api/v1/admin", admin_1.default);
// --- Penanganan Rute Tidak Ditemukan (404) ---
// Tangani semua rute yang tidak cocok dengan rute di atas
app.all('*', (req, res, next) => {
    res.status(404).json({
        status: 'fail',
        message: `Can't find ${req.originalUrl} on this server!`,
    });
});
// --- Global Error Handling Middleware ---
// Ini harus menjadi middleware terakhir
app.use(errorMiddleware_1.default);
// --- START SERVER ---
models_1.default.sequelize
    .sync({ force: false }) // Gunakan { force: true } hanya saat development untuk reset database
    .then(() => {
    console.log("Database & tables synced successfully.");
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error("Unable to connect to the database or sync:", err);
    process.exit(1); // Keluar dari aplikasi jika koneksi DB gagal
});
