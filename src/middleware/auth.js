// src/middleware/auth.js

const jwt = require("jsonwebtoken");

/**
 * Middleware untuk memverifikasi token JWT.
 * Jika token valid, user akan ditambahkan ke `req.user` dan permintaan dilanjutkan.
 * Jika tidak, akan mengirim respons error.
 */
exports.isAuth = (req, res, next) => {
  // 1. Dapatkan token dari Authorization header
  const authHeader = req.headers.authorization;

  // 2. Periksa apakah header ada dan formatnya benar ('Bearer <token>')
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Authentication token is required." });
  }

  const token = authHeader.split(" ")[1];

  // 3. Verifikasi token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    // 4. Simpan payload token (berisi id dan role) ke object request
    req.user = decoded;
    next(); // Lanjutkan ke controller berikutnya
  });
};

/**
 * Middleware untuk memverifikasi peran user.
 * @param  {...string} roles - Daftar peran yang diizinkan.
 */
exports.hasRole = (...roles) => {
  return (req, res, next) => {
    // Middleware ini harus dijalankan SETELAH isAuth, sehingga req.user sudah ada.
    if (!req.user) {
      return res
        .status(403)
        .json({ message: "Forbidden: User not authenticated." });
    }

    if (roles.includes(req.user.role)) {
      return next(); // Peran user diizinkan, lanjutkan.
    }

    return res.status(403).json({
      message:
        "Forbidden: You do not have the required role to access this resource.",
    });
  };
};
