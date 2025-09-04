import "dotenv/config"; // Muat environment variables
import express, { Application, Request, Response, NextFunction } from "express";
import path from "path";
import cookieParser from "cookie-parser";
import cors from "cors";
import methodOverride from "method-override";

// Impor semua rute yang sudah di-TypeScript-kan
import userRoutes from "./routes/userRoutes";
import authRoutes from "./routes/authRoutes";
import productRoutes from "./routes/productRoutes";
import cartRoutes from "./routes/cartRoutes";
import sellerRoutes from "./routes/sellerRoutes";
import categoryRoutes from "./routes/categoryRoutes";
import categoryAdminRoutes from "./routes/categoryAdminRoutes";
import orderRoutes from "./routes/orderRoutes";
import adminProductRoutes from "./routes/adminProductRoutes"; // Pastikan path ini benar
import adminRoutes from "./routes/admin";
import adminOrderRoutes from "./routes/adminOrderRoutes";
import devRoutes from "./routes/devRoutes"; // Impor rute baru

// Impor model dan middleware
import db from "./models";
import globalErrorHandler from "./middleware/errorMiddleware";

const app: Application = express();
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
app.all("*", (req: Request, res: Response, next: NextFunction) => {
  res.status(404).json({
    status: "fail",
    message: `Can't find ${req.originalUrl} on this server!`,
  });
});

// --- Global Error Handling Middleware ---
// Ini harus menjadi middleware terakhir
app.use(globalErrorHandler);

// --- START SERVER ---
const startServer = async () => {
  try {
    // Sinkronisasi database saat server start di mode development
    if (process.env.NODE_ENV === "development") {
      await db.sequelize.sync({ alter: true });
      console.log("Database synchronized successfully.");
    }
    app.listen(PORT, () =>
      console.log(`Server is running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Unable to start server:", err);
    process.exit(1);
  }
};

startServer();
