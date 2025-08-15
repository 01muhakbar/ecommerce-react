const db = require("../models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // Untuk membuat token acak
const { Op } = require("sequelize"); // Untuk operator query

/**
 * Menampilkan halaman login.
 * Fungsi ini tidak lagi relevan karena halaman login disajikan secara statis
 * oleh app.js. Kita bisa menghapusnya atau membiarkannya jika ada rencana lain.
 */
const showLoginPage = (req, res) => {
  // app.js sudah menangani ini dengan res.sendFile, jadi fungsi ini bisa dikosongkan
  // atau dihapus dari rute jika tidak diperlukan lagi.
  res.status(200).send("API endpoint untuk GET /login. Halaman disajikan oleh Express Static.");
};

/**
 * Memproses data login dari user.
 */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // 1. Validasi input sekarang ditangani oleh express-validator middleware

    // 2. Cari user di database
    const user = await db.User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: "Email atau password salah." });
    }

    // 3. Bandingkan password yang diinput dengan hash di database
    const isMatch = await bcrypt.compare(password, user.password);
    // console.log(`Hasil perbandingan password untuk ${email}: ${isMatch}`); // Hapus atau komentari baris ini setelah selesai.
    if (!isMatch) {
      return res.status(401).json({ message: "Email atau password salah." });
    }

    // 4. Buat JWT Payload
    const accessTokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };

    // 5. Buat Access Token (berlaku singkat)
    const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET, {
      expiresIn: "15m", // Contoh: 15 menit
    });

    // 6. Buat Refresh Token (berlaku lama)
    const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
      expiresIn: "7d", // Contoh: 7 hari
    });

    // 7. Simpan refresh token ke database
    await user.update({ refreshToken: refreshToken });

    // 8. Kirim refresh token sebagai httpOnly cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true, // Mencegah akses dari JavaScript sisi client
      secure: process.env.NODE_ENV === "production", // Hanya kirim via HTTPS di production
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari
    });

    // 9. Kirim access token sebagai JSON
    res.status(200).json({ message: "Login berhasil", accessToken });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * Mendaftarkan user baru.
 */
const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    // 1. Validasi input sekarang ditangani oleh express-validator middleware
    // 2. Cek apakah email sudah terdaftar
    const existingUser = await db.User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ message: "Email sudah terdaftar." }); // 409 Conflict
    }

    // 3. Biarkan hook 'beforeCreate' di model yang melakukan hashing.

    // 4. Buat user baru di database
    const newUser = await db.User.create({
      name,
      email,
      password: password, // Kirim password plain, hook akan menghash-nya
    });

    // 5. Buat token agar user bisa langsung login setelah registrasi
    // Perbaikan: Sertakan role dalam payload agar konsisten
    const payload = { id: newUser.id, email: newUser.email, role: newUser.role };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });

    // Untuk registrasi, kita bisa langsung login-kan user dengan memberikan refresh token juga
    const refreshToken = jwt.sign({ id: newUser.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
    await newUser.update({ refreshToken: refreshToken });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ message: "Registrasi berhasil", accessToken });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * Membuat access token baru menggunakan refresh token.
 */
const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.sendStatus(401); // Unauthorized

    const user = await db.User.findOne({ where: { refreshToken } });
    if (!user) return res.sendStatus(403); // Forbidden

    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, decoded) => {
      if (err || user.id !== decoded.id) return res.sendStatus(403);

      const accessTokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role };
      const accessToken = jwt.sign(accessTokenPayload, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });

      res.json({ accessToken });
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.sendStatus(500);
  }
};

/**
 * Logout user dengan menghapus refresh token.
 */
const logoutUser = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) return res.sendStatus(204); // No Content

    const user = await db.User.findOne({ where: { refreshToken } });
    if (user) {
      await user.update({ refreshToken: null });
    }

    res.clearCookie("refreshToken");
    return res.status(200).json({ message: "Logout berhasil" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server saat logout." });
  }
};

/**
 * Menangani permintaan "Lupa Password".
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await db.User.findOne({ where: { email } });

    // PENTING: Selalu kirim respons yang sama untuk mencegah penyerang mengetahui email mana yang terdaftar.
    if (!user) {
      return res.status(200).json({ message: "Jika email terdaftar, Anda akan menerima link reset password." });
    }

    // 1. Buat token reset yang acak
    const resetToken = crypto.randomBytes(32).toString("hex");

    // 2. Hash token tersebut dan simpan ke database
    user.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // 3. Atur waktu kedaluwarsa (misalnya, 10 menit dari sekarang)
    user.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    await user.save();

    // 4. Buat URL reset dan simulasikan pengiriman email
    const resetURL = `${req.protocol}://${req.get("host")}/reset-password?token=${resetToken}`;

    // Di aplikasi production, Anda akan menggunakan library seperti Nodemailer untuk mengirim email.
    // Untuk pengembangan, kita cukup menampilkannya di konsol.
    console.log("====================================");
    console.log("PASSWORD RESET LINK (UNTUK DEVELOPMENT):");
    console.log(resetURL);
    console.log("====================================");

    res.status(200).json({ message: "Jika email terdaftar, Anda akan menerima link reset password." });
  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

/**
 * Menangani proses reset password dengan token.
 */
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // 1. Hash token yang datang dari klien untuk dicocokkan dengan yang ada di DB
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // 2. Cari user berdasarkan token yang sudah di-hash dan belum kedaluwarsa
    const user = await db.User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: Date.now() }, // [Op.gt] = "greater than"
      },
    });

    if (!user) {
      return res.status(400).json({ message: "Token tidak valid atau sudah kedaluwarsa." });
    }

    // 3. Atur password baru dan hapus data token reset
    user.password = password; // Serahkan hashing ke hook 'beforeUpdate' di model Anda
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save(); // Hook 'beforeUpdate' akan terpicu secara otomatis di sini

    res.status(200).json({ message: "Password berhasil direset. Silakan login." });
  } catch (error) {
    console.error("Reset Password Error:", error);
    res.status(500).json({ message: "Terjadi kesalahan pada server." });
  }
};

module.exports = { showLoginPage, loginUser, registerUser, refreshToken, logoutUser, forgotPassword, resetPassword };
