const { User } = require("../models");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const sendEmail = require("../services/emailService");

// Helper function untuk menandatangani (sign) JWT
const signToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });
};

// Helper function untuk membuat token, mengatur cookie, dan mengirim respons
const createAndSendToken = (user, statusCode, res) => {
  const token = signToken(user.id, user.role);

  const cookieExpiresInDays = parseInt(
    process.env.JWT_COOKIE_EXPIRES_IN || 90,
    10
  );
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresInDays * 24 * 60 * 60 * 1000),
    httpOnly: true, // Mencegah serangan XSS
    path: "/",
    sameSite: "strict", // Mencegah serangan CSRF
    secure: process.env.NODE_ENV === "production", // Hanya kirim melalui HTTPS di production
  };

  res.cookie("jwt", token, cookieOptions);

  // Hapus password dari output
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    // Token tidak dikirim di body untuk client web yang menggunakan cookie
    data: {
      user: {
        // Kirim objek user yang sudah dikurasi
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
};

/**
 * Menangani registrasi user baru dan langsung login
 */
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Validasi input dasar
    if (!name || !email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Nama, email, dan password harus diisi.",
      });
    }

    // 2. Buat user baru (password di-hash oleh hook di model User)
    const newUser = await User.create({
      name,
      email,
      password,
      role: role || "pembeli", // Default ke 'pembeli' jika tidak disediakan
    });

    // 3. Kirim token dan loginkan user
    createAndSendToken(newUser, 201, res);
  } catch (error) {
    // Tangani error duplikat email
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        status: "fail",
        message: "Email sudah terdaftar.",
      });
    }
    console.error("REGISTER ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan pada server saat registrasi.",
    });
  }
};

/**
 * Menangani login user
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validasi input
    if (!email || !password) {
      return res.status(400).json({
        status: "fail",
        message: "Email dan password harus diisi.",
      });
    }

    // 2. Cari pengguna berdasarkan email
    const user = await User.findOne({ where: { email } });

    // 3. Verifikasi user dan password
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        status: "fail",
        message: "Email atau password salah.",
      });
    }

    // 4. Jika semua benar, kirim token ke klien
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan pada server saat login.",
    });
  }
};

exports.logout = (req, res) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).redirect("/login");
};

exports.forgotPassword = async (req, res) => {
  try {
    // 1. Dapatkan user berdasarkan email dari body
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      return res.status(404).json({
        status: "fail",
        message: "Tidak ada pengguna dengan alamat email tersebut.",
      });
    }

    // 2. Buat token reset
    const resetToken = user.createPasswordResetToken();
    await user.save({ validate: false }); // Simpan token ke DB, nonaktifkan validasi sementara

    // 3. Kirim token ke email user
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/api/v1/auth/reset-password/${resetToken}`;

    const message = `
          <p>Halo ${user.name},</p>
          <p>Anda menerima email ini karena Anda (atau orang lain) telah meminta reset kata sandi untuk akun Anda.</p>
          <p>Silakan klik tautan berikut, atau tempelkan ini ke browser Anda untuk menyelesaikan prosesnya:</p>
          <p><a href="${resetURL}">${resetURL}</a></p>
          <p>Jika Anda tidak meminta ini, abaikan email ini dan kata sandi Anda akan tetap sama.</p>
          <p>Link ini akan kedaluwarsa dalam 10 menit.</p>
        `;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Reset Kata Sandi Anda',
        message: message,
      });

      res.status(200).json({
        status: "success",
        message: "Token reset password telah dikirim ke email Anda.",
      });
    } catch (emailError) {
      // Jika ada error saat mengirim email, hapus token dan expiry date untuk keamanan
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validate: false });

      console.error("EMAIL SENDING ERROR:", emailError);
      return res.status(500).json({
        status: "error",
        message: "Terjadi kesalahan saat mengirim email. Coba lagi nanti.",
      });
    }
  } catch (error) {
    // Jika ada error, hapus token dan expiry date untuk keamanan
    // user.passwordResetToken = undefined;
    // user.passwordResetExpires = undefined;
    // await user.save({ validate: false });
    console.error("FORGOT PASSWORD ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mengirim email. Coba lagi nanti.",
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    // 1. Dapatkan user berdasarkan token dari URL
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        // Pastikan token belum kedaluwarsa
        // passwordResetExpires: { [Op.gt]: Date.now() },
      },
    });

    // 2. Jika token tidak valid atau sudah kedaluwarsa
    if (!user) {
      return res.status(400).json({
        status: "fail",
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
    }

    // 3. Set password baru
    user.password = req.body.password; // Hook `beforeSave` akan otomatis hash password ini
    user.passwordResetToken = null; // Hapus token setelah digunakan
    user.passwordResetExpires = null;
    await user.save();

    // 4. Login user dan kirim JWT baru
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res.status(500).json({
      status: "error",
      message: "Terjadi kesalahan saat mereset password.",
    });
  }
};
