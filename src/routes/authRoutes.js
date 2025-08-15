const express = require('express');
const router = express.Router();
const { showLoginPage, loginUser, registerUser, refreshToken, logoutUser, forgotPassword, resetPassword } = require('../controllers/authController');
const { registerValidation, resetPasswordValidation, loginValidation } = require('../middleware/validators');

// Rute untuk MENAMPILKAN halaman login
// Ini adalah rute yang hilang dan menyebabkan error "Cannot GET /login"
router.get('/login', showLoginPage);

// Rute untuk MEMPROSES data login
router.post('/login', loginValidation, loginUser);

// Rute untuk MEMPROSES data registrasi user baru
router.post('/register', registerValidation, registerUser);

// Rute untuk mendapatkan access token baru
router.post('/refresh', refreshToken);

// Rute untuk logout
router.post('/logout', logoutUser);

// Rute untuk lupa password
router.post('/forgot-password', forgotPassword);

// Rute untuk mereset password dengan token
router.post('/reset-password', resetPasswordValidation, resetPassword);

module.exports = router;
