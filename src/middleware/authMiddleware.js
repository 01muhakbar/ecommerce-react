const jwt = require("jsonwebtoken");
const { User } = require("../models");

/**
 * Middleware untuk melindungi rute.
 * Memverifikasi token JWT dari cookie dan melampirkan data pengguna ke request.
 */
const protect = async (req, res, next) => {
  let token;

  // 1. Ambil token dari http-only cookie
  if (req.cookies.token) {
    try {
      // 2. Verifikasi token
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);

      // 3. Dapatkan data pengguna dari token (tanpa password) dan lampirkan ke request
      req.user = await User.findByPk(decoded.id, {
        attributes: { exclude: ["password", "refreshToken"] },
      });

      if (!req.user) {
        // Jika pengguna tidak ditemukan (misalnya, telah dihapus)
        return res.redirect("/login");
      }

      next(); // Lanjutkan ke rute berikutnya
    } catch (error) {
      console.error("Authentication error:", error);
      return res.redirect("/login");
    }
  } else {
    // Jika tidak ada token, arahkan ke halaman login
    return res.redirect("/login");
  }
};

module.exports = { protect };
