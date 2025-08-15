// src/controllers/userController.js

const db = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// Fungsi untuk registrasi user baru
exports.registerUser = async (req, res) => {
  try {
    const { name, email, password, role, storeName } = req.body;

    // Buat user baru (password akan di-hash oleh hook di model User)
    const newUser = await db.User.create({
      name,
      email,
      password,
      role,
      storeName,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to register user", error: error.message });
  }
};

// Fungsi untuk login user
exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Cari user berdasarkan email
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Bandingkan password yang diinput dengan yang ada di database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // 3. Jika cocok, buat JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h", // Token berlaku selama 1 jam
      }
    );

    res.status(200).json({ message: "Login successful", token });
  } catch (error) {
    console.error("LOGIN ERROR:", error); // Tambahkan log untuk debugging
    res.status(500).json({
      message: "An internal server error occurred.",
      error: error.message,
    });
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
