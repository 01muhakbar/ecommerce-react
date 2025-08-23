const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// Rute untuk registrasi user baru
router.post("/register", authController.register);

// Rute untuk login user
router.post("/login", authController.login);

// Rute untuk logout user
router.post("/logout", authController.logout);

// --- Rute untuk Manajemen Password ---

// Rute untuk meminta reset password (mengirim email ke pengguna)
router.post("/forgot-password", authController.forgotPassword);

// Rute untuk melakukan reset password dengan token yang valid
const path = require("path");

// Rute untuk melakukan reset password dengan token yang valid
router.patch("/reset-password/:token", authController.resetPassword);

// Rute untuk menampilkan halaman reset password
router.get("/reset-password/:token", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "..", "public", "reset-password.html"));
});

module.exports = router;
