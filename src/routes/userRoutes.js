// src/routes/userRoutes.js

const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { isAuth } = require("../middleware/auth");

// Rute untuk registrasi: POST /api/users/register
router.post("/register", userController.registerUser);

// Rute untuk login: POST /api/users/login
router.post("/login", userController.loginUser);

// Rute untuk mendapatkan profil user (dilindungi oleh middleware isAuth)
router.get("/profile", isAuth, userController.getUserProfile);

module.exports = router;
