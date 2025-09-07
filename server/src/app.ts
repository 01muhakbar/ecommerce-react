import "dotenv/config";
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import methodOverride from "method-override";
import { fileURLToPath } from "url";

// Impor semua rute yang sudah di-TypeScript-kan
import userRoutes from "./routes/userRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import sellerRoutes from "./routes/sellerRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import categoryAdminRoutes from "./routes/categoryAdminRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import adminProductRoutes from "./routes/adminProductRoutes.js";
import adminRoutes from "./routes/admin.js";
import adminOrderRoutes from "./routes/adminOrderRoutes.js";
import devRoutes from "./routes/devRoutes.js";

// Impor model dan middleware
import globalErrorHandler from "./middleware/errorMiddleware.js";
import { initializeDatabase } from "./models/index.js";

const app: express.Application = express();
const PORT: number = parseInt(process.env.PORT || "3000", 10);

// Middleware
app.use(express.json()); // Untuk parsing application/json
app.use(express.urlencoded({ extended: true })); // Untuk parsing application/x-www-form-urlencoded
app.use(methodOverride("_method")); // Untuk mendukung PUT/DELETE dari form HTML
app.use(cookieParser()); // Untuk mem-parsing cookie
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
); // Aktifkan CORS untuk semua rute

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sajikan file statis dari folder 'public'
app.use(express.static(path.join(__dirname, "..", "public")));

// --- Rute API --- (Semua rute sekarang adalah API)

// Rute utama API v1
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productRoutes);
app.use("/api/v1/cart", cartRoutes);
app.use("/api/v1/sellers", sellerRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/admin/categories", categoryAdminRoutes);
app.use("/api/v1/orders", orderRoutes);
app.use("/api/v1/admin", adminRoutes);
app.use("/api/v1/admin/products", adminProductRoutes);
app.use("/api/v1/admin/orders", adminOrderRoutes);
app.use("/api/v1/dev", devRoutes); // Daftarkan rute baru

// --- Penanganan Rute Tidak Ditemukan (404) ---
// Tangani semua rute yang tidak cocok dengan rute di atas
app.all(
  "*",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(404).json({
      status: "fail",
      message: `Can't find ${req.originalUrl} on this server!`,
    });
  }
);

// --- Global Error Handling Middleware ---
// Ini harus menjadi middleware terakhir
app.use(globalErrorHandler);

// --- START SERVER ---
const startServer = async () => {
  try {
    const db = await initializeDatabase(); // Inisialisasi database dan model
    // Sinkronisasi database saat server start di mode development
    if (process.env.NODE_ENV === "development") {
      // await db.sequelize.sync({ alter: true });
      // console.log("Database synchronized successfully.");
    }
    app.listen(PORT, () =>
      console.log(`Server is running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Unable to start server:", err);
    process.exit(1);
  }
};

console.log("JWT_SECRET:", process.env.JWT_SECRET);

startServer();
