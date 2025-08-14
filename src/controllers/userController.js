// src/controllers/userController.js
const User = require("../models/User");
const bcrypt = require("bcrypt");

// Menampilkan form registrasi pembeli
exports.showRegisterForm = (req, res) => {
  res.render("register");
};

// Memproses data registrasi pembeli
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
    });

    req.flash("success", "Registrasi berhasil! Silakan login.");
    return res.redirect("/login");
  } catch (error) {
    console.error("ERROR REGISTRASI PEMBELI:", error);
    req.flash("error", "Email sudah digunakan atau terjadi kesalahan.");
    return res.redirect("/register");
  }
};

// Menampilkan form registrasi penjual
exports.showSellerRegisterForm = (req, res) => {
  res.render("register-seller");
};

// Memproses data registrasi penjual
exports.registerSeller = async (req, res) => {
  try {
    const { name, email, password, storeName } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      password: hashedPassword,
      storeName,
      role: "penjual",
    });

    req.flash("success", "Registrasi penjual berhasil! Silakan login.");
    return res.redirect("/login");
  } catch (error) {
    console.error("ERROR REGISTRASI PENJUAL:", error);
    req.flash("error", "Email sudah digunakan atau terjadi kesalahan.");
    return res.redirect("/register-seller");
  }
};

// Menampilkan form login
exports.showLoginForm = (req, res) => {
  res.render("login");
};

// Memproses data login
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      req.flash("error", "Email atau password salah.");
      return res.redirect("/login");
    }

    // Simpan informasi sesi
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.userRole = user.role;

    req.flash("success", `Selamat datang kembali, ${user.name}!`);

    // ==========================================
    // ARAHKAN PENGGUNA BERDASARKAN PERAN (ROLE)
    // ==========================================
    if (user.role === "penjual" || user.role === "admin") {
      // Jika penjual atau admin, arahkan ke dashboard penjual
      return res.redirect("/dashboard/seller");
    } else {
      // Jika pembeli (atau peran lain), arahkan ke halaman produk
      return res.redirect("/products");
    }
  } catch (error) {
    console.error("ERROR LOGIN:", error);
    req.flash("error", "Terjadi kesalahan, silakan coba lagi.");
    return res.redirect("/login");
  }
};

// Memproses logout
exports.logoutUser = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("ERROR LOGOUT:", err);
      return res.redirect("/products");
    }
    res.clearCookie("connect.sid");
    return res.redirect("/login");
  });
};

// Menampilkan dashboard khusus penjual
exports.showSellerDashboard = (req, res) => {
  // Mengambil pesan flash yang mungkin ada (misal: dari login)
  const messages = req.flash();
  res.render("dashboard-seller", { messages });
};
