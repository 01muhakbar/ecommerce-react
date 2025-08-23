// src/routes/userRoutes.js

const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect, restrictTo } = require("../middleware/authMiddleware"); // Import restrictTo

// Rute untuk mendapatkan profil user (dilindungi oleh middleware isAuth)
// Menggunakan '/me' adalah konvensi umum untuk mendapatkan data pengguna saat ini
router.get("/me", protect, userController.getUserProfile);

// Rute untuk user menjadi penjual
router.patch("/become-seller", protect, userController.becomeSeller);

// --- Admin User Management Routes ---
router.use(protect, restrictTo("admin")); // All routes below this will be protected and restricted to admin

router.get("/", userController.getAllUsers); // Get all users
router.get("/:id", userController.getUserById); // Get a single user by ID
router.patch("/:id", userController.updateUser); // Update a user by ID
router.delete("/:id", userController.deleteUser); // Delete a user by ID

module.exports = router;
