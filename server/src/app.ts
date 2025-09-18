import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs"; // Impor bcrypt
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
import adminCustomerRoutes from "./routes/adminCustomerRoutes.js";
import adminStaffRoutes from "./routes/adminStaffRoutes.js";

// Impor model dan middleware
import globalErrorHandler from "./middleware/errorMiddleware.js";
import { initializeDatabase, Db } from "./models/index.js"; // Impor tipe Db

// Recreate __dirname for ESM since it's used in express.static
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
app.use("/api/v1/admin/customers", adminCustomerRoutes);
app.use("/api/v1/admin/staff", adminStaffRoutes);
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

// Fungsi untuk membuat admin default jika tidak ada
const createDefaultAdmin = async (db: Db) => {
  const { User } = db;
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
  const ADMIN_NAME  = process.env.ADMIN_NAME  || 'Admin User';
  const RAW_PASS    = process.env.ADMIN_PASSWORD || 'Admin@123';
  const ADMIN_ROLE  = 'Admin'; // Consistent role casing

  console.log('[SEED] Ensuring default admin exists...', { email: ADMIN_EMAIL });

  try {
    const [user, created] = await User.findOrCreate({
      where: { email: ADMIN_EMAIL },
      defaults: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: await bcrypt.hash(RAW_PASS, 12),
        role: ADMIN_ROLE,
        isActive: true,
        // isPublished is not a field in the model I read, so I am omitting it.
      },
    });

    if (created) {
      console.log(`[SEED] Default admin created: ${user.email}`);
    } else {
      // If user already existed, check if role needs updating
      const needsUpdate = user.role !== ADMIN_ROLE || !user.isActive;
      if (needsUpdate) {
        await user.update({
          role: ADMIN_ROLE,
          isActive: true,
        });
        console.log(`[SEED] Default admin already exists and was updated: ${user.email}`);
      } else {
        console.log(`[SEED] Default admin already exists and is up-to-date: ${user.email}`);
      }
    }
  } catch (error) {
    console.error("[SEED] Failed to create or update default admin user:", error);
  }
};

// --- START SERVER ---
const startServer = async () => {
  try {
    const db = await initializeDatabase(); // Inisialisasi database dan model

    // Di mode development, pastikan ada admin default
    if (process.env.NODE_ENV === "development") {
      await db.sequelize.sync({ alter: true }); // Gunakan alter: true untuk menjaga data
      console.log("Database synchronized with { alter: true }.");
      await createDefaultAdmin(db);
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
