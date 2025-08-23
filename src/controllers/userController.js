// src/controllers/userController.js

const db = require("../models");

// Renders the correct dashboard based on user role
exports.renderDashboard = (req, res) => {
  const { user } = req; // User object from 'protect' middleware

  const viewData = {
    user,
    isLoggedIn: true,
    messages: {}, // For any flash messages
  };

  if (user.role === 'admin') {
    res.render('admin/dashboard-admin', viewData);
  } else if (user.role === 'penjual') {
    res.render('dashboard-seller', viewData);
  } else {
    res.render('dashboard-pembeli', viewData);
  }
};

// Fungsi untuk mendapatkan profil user yang sedang login
exports.getUserProfile = async (req, res) => {
  try {
    // ID user didapatkan dari middleware isAuth (req.user.id)
    const user = await db.User.findByPk(req.user.id, {
      // Jangan sertakan password dalam respons
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(200).json(user);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch user profile.", error: error.message });
  }
};

// Fungsi untuk mengubah role user menjadi penjual
exports.becomeSeller = async (req, res) => {
  try {
    const { storeName } = req.body; // Assuming description is not needed for now, or can be added later

    // Dapatkan user dari req.user yang disuntikkan oleh middleware protect
    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found.",
      });
    }

    // Pastikan user belum menjadi penjual atau admin
    if (user.role === "penjual" || user.role === "admin") {
      return res.status(400).json({
        status: "fail",
        message: "Anda sudah terdaftar sebagai penjual atau admin.",
      });
    }

    // Update role menjadi 'penjual' dan simpan nama toko
    user.role = "penjual";
    user.storeName = storeName; // Assuming storeName is required for sellers
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Selamat! Anda sekarang adalah penjual.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeName: user.storeName,
        },
      },
    });
  } catch (error) {
    console.error("BECOME SELLER ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mendaftar sebagai penjual.",
      error: error.message,
    });
  }
};

// --- Admin User Management Functions ---

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await db.User.findAll({
      attributes: { exclude: ["password", "refreshToken", "passwordResetToken", "passwordResetExpires"] },
    });
    res.status(200).json({
      status: "success",
      results: users.length,
      data: {
        users,
      },
    });
  } catch (error) {
    console.error("GET ALL USERS ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mengambil data pengguna.",
      error: error.message,
    });
  }
};

// Get a single user by ID (Admin only)
exports.getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10); // Parse ID to integer
    const user = await db.User.findByPk(userId, {
      attributes: { exclude: ["password", "refreshToken", "passwordResetToken", "passwordResetExpires"] },
    });

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Pengguna tidak ditemukan.",
      });
    }

    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (error) {
    console.error("GET USER BY ID ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mengambil data pengguna.",
      error: error.message,
    });
  }
};

// Update a user by ID (Admin only)
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, storeName } = req.body;
    const user = await db.User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Pengguna tidak ditemukan.",
      });
    }

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (role) user.role = role;
    if (storeName) user.storeName = storeName;

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Data pengguna berhasil diperbarui.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          storeName: user.storeName,
        },
      },
    });
  } catch (error) {
    console.error("UPDATE USER ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat memperbarui pengguna.",
      error: error.message,
    });
  }
};

// Delete a user by ID (Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.params.id);

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Pengguna tidak ditemukan.",
      });
    }

    await user.destroy();

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    console.error("DELETE USER ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat menghapus pengguna.",
      error: error.message,
    });
  }
};