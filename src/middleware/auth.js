// middleware/auth.js
// Middleware untuk memastikan pengguna sudah login (autentikasi)
exports.isAuth = (req, res, next) => {
  if (req.session.userId) {
    return next();
  }
  req.flash("error", "Silakan login terlebih dahulu.");
  res.redirect("/login");
};

// Middleware untuk memastikan pengguna adalah ADMIN (otorisasi)
exports.isAdmin = (req, res, next) => {
  if (req.session.userRole === "admin") {
    return next(); // Lanjutkan jika admin
  }
  req.flash("error", "Anda tidak memiliki hak akses admin.");
  res.redirect("/");
};

// Middleware untuk memastikan pengguna adalah PENJUAL (otorisasi)
exports.isPenjual = (req, res, next) => {
  if (req.session.userRole === "penjual") {
    return next(); // Lanjutkan jika penjual
  }
  req.flash("error", "Hanya penjual yang bisa mengakses halaman ini.");
  res.redirect("/");
};

// Middleware untuk memastikan pengguna adalah PENJUAL atau ADMIN
exports.isPenjualOrAdmin = (req, res, next) => {
  const role = req.session.userRole;
  if (role === "penjual" || role === "admin") {
    return next(); // Lanjutkan jika penjual atau admin
  }
  req.flash("error", "Anda tidak memiliki hak akses untuk halaman ini.");
  res.redirect("/"); // Arahkan ke halaman utama jika bukan penjual/admin
};
