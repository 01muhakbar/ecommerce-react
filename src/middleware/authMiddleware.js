const jwt = require("jsonwebtoken");
const db = require("../models");

const protect = async (req, res, next) => {
  let token;

  // Cek apakah token ada di header 'Authorization' dan dimulai dengan 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Ambil token dari header (format: "Bearer <token>")
      token = req.headers.authorization.split(" ")[1];

      // Verifikasi token menggunakan secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Cari user berdasarkan id dari payload token dan lampirkan ke request
      // -password untuk mengecualikan field password dari data user
      req.user = await db.User.findByPk(decoded.id, {
        attributes: { exclude: ["password"] },
      });

      next(); // Lanjutkan ke rute berikutnya
    } catch (error) {
      return res.status(401).json({ message: "Tidak terautentikasi, token gagal." });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "Tidak terautentikasi, tidak ada token." });
  }
};

/**
 * Middleware untuk memverifikasi peran (role) user.
 * @param {...string} roles - Daftar peran yang diizinkan untuk mengakses rute.
 * Contoh penggunaan: authorize('admin') atau authorize('penjual', 'pembeli')
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    // Middleware ini harus dijalankan setelah middleware 'protect',
    // karena kita butuh req.user yang sudah di-set.
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Akses ditolak. Anda tidak memiliki izin yang diperlukan.",
      });
    }
    next();
  };
};

module.exports = { protect, authorize };