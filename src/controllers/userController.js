// src/controllers/userController.js

const db = require("../models");
const { Op } = require("sequelize");

// Renders the correct dashboard based on user role
exports.renderDashboard = (req, res) => {
  const { user } = req; // User object from 'protect' middleware

  const viewData = {
    user,
    isLoggedIn: true,
    messages: {}, // For any flash messages
  };

  if (user.role === "admin") {
    res.render("admin/dashboard-admin", viewData);
  } else if (user.role === "penjual") {
    res.render("dashboard-seller", viewData);
  } else {
    res.render("dashboard-pembeli", viewData);
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

// --- User Profile Management Functions ---
exports.renderProfilePage = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.id, {
      attributes: {
        exclude: [
          "password",
          "refreshToken",
          "passwordResetToken",
          "passwordResetExpires",
        ],
      },
    });

    if (!user) {
      return res.status(404).render("error", { message: "User not found." }); // Render an error page
    }
    console.log("RENDER PROFILE PAGE: User data retrieved:", user.toJSON()); // Log user data retrieved

    res.render("user/profile", {
      user,
      isLoggedIn: true,
      messages: {},
    });
  } catch (error) {
    console.error("RENDER PROFILE PAGE ERROR:", error);
    res
      .status(500)
      .render("error", {
        message: "Failed to load profile page.",
        error: error.message,
      });
  }
};

exports.updateMyProfile = async (req, res) => {
  try {
    const { name, email, phoneNumber, gender, dateOfBirth, storeName } =
      req.body;
    console.log("UPDATE MY PROFILE: Received body:", req.body); // Log received data

    const user = await db.User.findByPk(req.user.id);

    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "User not found.",
      });
    }

    console.log("UPDATE MY PROFILE: User before update:", user.toJSON()); // Log user data before update

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (gender) user.gender = gender;
    if (dateOfBirth) user.dateOfBirth = dateOfBirth;
    if (storeName) user.storeName = storeName; // Only update if user is a seller or becoming one

    await user.save();
    console.log("UPDATE MY PROFILE: User after save:", user.toJSON()); // Log user data after save

    res.status(200).json({
      status: "success",
      message: "Profil berhasil diperbarui.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          storeName: user.storeName,
          role: user.role, // Include role for context
        },
      },
    });
  } catch (error) {
    console.error("UPDATE MY PROFILE ERROR:", error);
    // Handle duplicate email error
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        status: "fail",
        message: "Email sudah terdaftar.",
      });
    }
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat memperbarui profil.",
      error: error.message,
    });
  }
};

// --- Admin User Management Functions ---

// Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    res.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    let where = {};
    const { role, isActive, gender, search } = req.query;

    if (role) {
      where.role = role;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === "true";
    }
    if (gender) {
      where.gender = gender;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await db.User.findAll({
      where,
      attributes: {
        exclude: [
          "password",
          "refreshToken",
          "passwordResetToken",
          "passwordResetExpires",
        ],
      },
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
      attributes: {
        exclude: [
          "password",
          "refreshToken",
          "passwordResetToken",
          "passwordResetExpires",
        ],
      },
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
    const { name, email, role, storeName, phoneNumber, gender, dateOfBirth } =
      req.body; // Added new fields
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
    if (phoneNumber) user.phoneNumber = phoneNumber; // Added
    if (gender) user.gender = gender; // Added
    if (dateOfBirth) user.dateOfBirth = dateOfBirth; // Added

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Data pengguna berhasil diperbarui.",
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber, // Added
          gender: user.gender, // Added
          dateOfBirth: user.dateOfBirth, // Added
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

// Update user active status (Admin only)
exports.updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { isActive } = req.body; // Expecting true or false

    console.log("--- updateUserStatus Debug ---");
    console.log("Received userId:", userId);
    console.log("Received isActive:", isActive);
    console.log("Type of isActive:", typeof isActive);

    if (typeof isActive !== "boolean") {
      console.log("Error: isActive is not a boolean.");
      return res.status(400).json({
        status: "fail",
        message: "Invalid value for isActive. Must be a boolean.",
      });
    }

    const user = await db.User.findByPk(userId);

    if (!user) {
      console.log("Error: User not found for userId:", userId);
      return res.status(404).json({
        status: "fail",
        message: "Pengguna tidak ditemukan.",
      });
    }

    console.log("User found:", user.name, "Current isActive:", user.isActive);

    user.isActive = isActive;
    await user.save();

    console.log("User status updated to:", user.isActive);

    res.status(200).json({
      status: "success",
      message: `Status pengguna berhasil diperbarui menjadi ${
        isActive ? "aktif" : "nonaktif"
      }.`,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        },
      },
    });
  } catch (error) {
    console.error("UPDATE USER STATUS ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat memperbarui status pengguna.",
      error: error.message,
    });
  }
};

// Create a new user (Admin only)
exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, storeName } = req.body;

    // 1. Basic input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Nama, email, dan password harus diisi.",
      });
    }

    // 2. Create new user
    const newUser = await db.User.create({
      name,
      email,
      password,
      role: role || "pembeli", // Default to 'pembeli' if not provided
      storeName: role === "penjual" ? storeName : null, // Only set storeName if role is 'penjual'
    });

    res.status(201).json({
      status: "success",
      message: "Pengguna berhasil ditambahkan.",
      data: {
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          storeName: newUser.storeName,
        },
      },
    });
  } catch (error) {
    // Handle duplicate email error
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        status: "fail",
        message: "Email sudah terdaftar.",
      });
    }
    console.error("CREATE USER ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan pada server saat membuat pengguna.",
    });
  }
};

// Get all sellers (Admin only)
exports.getAllSellers = async (req, res) => {
  try {
    const sellers = await db.User.findAll({
      where: {
        role: "penjual",
      },
      attributes: ["id", "name"], // Only get id and name
    });
    res.status(200).json({
      status: "success",
      results: sellers.length,
      data: {
        sellers,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Error fetching sellers.",
      error: error.message,
    });
  }
};

exports.renderAdminUsersPage = async (req, res) => {
  try {
    const { role: selectedRole } = req.query; // Get selected role from query parameters

    // Fetch initial users (can be filtered later by client-side JS)
    const users = await db.User.findAll({
      attributes: {
        exclude: [
          "password",
          "refreshToken",
          "passwordResetToken",
          "passwordResetExpires",
        ],
      },
    });

    // Define filter options (roles, statuses, genders)
    const roles = ["admin", "penjual", "pembeli"]; // Example roles
    const statuses = [
      { value: "true", label: "Active" },
      { value: "false", label: "Inactive" },
    ];
    const genders = ["Laki-laki", "Perempuan"]; // Example genders

    res.render("admin/users", {
      users,
      roles,
      statuses,
      genders,
      selectedRole, // Pass the selected role to the template
      isLoggedIn: true,
      user: req.user,
      messages: {},
    });
  } catch (error) {
    console.error("RENDER ADMIN USERS PAGE ERROR:", error);
    res.status(500).send("Error loading admin users page: " + error.message);
  }
};

// Utility function to update user role by email
exports.updateUserRoleByEmail = async (email, newRole) => {
  try {
    const user = await db.User.findOne({ where: { email: email } });

    if (!user) {
      return { success: false, message: "Pengguna tidak ditemukan." };
    }

    user.role = newRole;
    await user.save();

    return {
      success: true,
      message: `Role pengguna ${email} berhasil diperbarui menjadi ${newRole}.`,
    };
  } catch (error) {
    console.error("UPDATE USER ROLE BY EMAIL ERROR:", error);
    return {
      success: false,
      message: "Terjadi kesalahan saat memperbarui role pengguna.",
      error: error.message,
    };
  }
};
