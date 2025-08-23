const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const { User } = require("../models");

// Middleware untuk melindungi rute dengan memeriksa JWT yang valid
exports.protect = async (req, res, next) => {
  try {
    let token;
    // 1. Periksa token di header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Periksa token di cookies (fallback)
    else if (req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    const isApiRequest = req.originalUrl.startsWith('/api');

    if (!token || token === "loggedout") {
      if (isApiRequest) {
        return res.status(401).json({ status: 'fail', message: 'You are not logged in. Please log in to get access.' });
      }
      return res.redirect("/login");
    }

    // 3. Verifikasi token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 4. Periksa apakah pengguna masih ada
    const currentUser = await User.findByPk(decoded.id);
    if (!currentUser) {
      if (isApiRequest) {
        return res.status(401).json({ status: 'fail', message: 'The user belonging to this token does no longer exist.' });
      }
      res.clearCookie("jwt");
      return res.redirect("/login");
    }

    // 4a. Periksa apakah pengguna aktif
    if (!currentUser.isActive) {
      if (isApiRequest) {
        return res.status(403).json({ status: 'fail', message: 'Your account has been deactivated. Please contact support.' });
      }
      res.clearCookie("jwt"); // Clear cookie to force re-login
      return res.redirect("/login?message=account_deactivated"); // Redirect with a message
    }

    // 5. Berikan akses ke rute yang dilindungi
    // Lampirkan data pengguna ke objek request untuk digunakan nanti
    req.user = currentUser;
    next();
  } catch (error) {
    const isApiRequest = req.originalUrl.startsWith('/api');
    if (isApiRequest) {
      return res.status(401).json({ status: 'fail', message: 'Invalid or expired token. Please log in again.' });
    }
    return res.redirect("/login");
  }
};

// Middleware untuk membatasi akses ke peran tertentu
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // 'roles' adalah array seperti ['admin', 'penjual'].
    // req.user.role tersedia karena middleware 'protect' berjalan lebih dulu.
    if (!roles.includes(req.user.role)) {
      // Anda bisa membuat halaman 'unauthorized.html' untuk pengalaman pengguna yang lebih baik
      return res
        .status(403)
        .send(
          '<h1>403 - Forbidden</h1><p>Anda tidak memiliki izin untuk mengakses halaman ini.</p><a href="/dashboard">Kembali ke Dashboard</a>'
        );
    }
    next();
  };
};
