// src/middleware/auth.js

const jwt = require("jsonwebtoken");

/**
 * Middleware untuk memverifikasi token JWT.
 * Jika token valid, user akan ditambahkan ke `req.user` dan permintaan dilanjutkan.
 * Jika tidak, akan mengirim respons error.
 */
exports.isAuth = (req, res, next) => {
  let token;

  // 1. Dapatkan token dari Authorization header
  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  // 2. Dapatkan token dari cookies (fallback)
  else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // 3. Periksa apakah token ada
  if (!token) {
    return res
      .status(401)
      .json({ message: "Authentication token is required." });
  }

  // 4. Verifikasi token
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Invalid or expired token." });
    }

    // 5. Simpan payload token (berisi id dan role) ke object request
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
