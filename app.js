require("dotenv").config(); // Muat environment variables
const express = require("express");
const path = require("path"); // Impor modul path
const cookieParser = require("cookie-parser"); // Impor cookie-parser
// Impor objek `db` dari direktori models yang sudah kita perbaiki
const db = require("./src/models");

// Impor rute-rute Anda di sini
const userRoutes = require("./src/routes/userRoutes");
const productRoutes = require("./src/routes/productRoutes");
const cartRoutes = require("./src/routes/cartRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware untuk membaca body JSON dari request
app.use(express.json());

// Middleware untuk mem-parsing cookie dari request
app.use(cookieParser());

// Sajikan file statis dari direktori 'public'
// Contoh: akses http://localhost:3000/login.html
app.use(express.static(path.join(__dirname, "public")));

// Gunakan rute-rute Anda
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);

// Sinkronisasi database lalu jalankan server
db.sequelize
  .sync({ force: false }) // Gunakan { force: true } hanya saat development untuk reset database
  .then(() => {
    console.log("Database & tables synced successfully.");
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to sync database:", err);
  });
