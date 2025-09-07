import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import initializedDbPromise from "../models/index.js";
import sendEmail from "../services/emailService.js";
import { Op } from "sequelize";
const db = await initializedDbPromise;
const { User } = db;

// Helper function to sign JWT
const signToken = (id: number, role: string): string => {
  const secret = process.env.JWT_SECRET as string;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  const options: jwt.SignOptions = {
    expiresIn: (process.env.JWT_EXPIRES_IN || "90d") as any,
  };
  console.log("Signing token with ID:", id, "and Role:", role);
  return jwt.sign({ id, role }, secret, options);
};

// Helper function to create a token, set a cookie, and send the response
export const createAndSendToken = (
  user: any,
  statusCode: number,
  res: express.Response
): void => {
  const token = signToken(user.id, user.role);

  const cookieExpiresInDays = parseInt(
    process.env.JWT_COOKIE_EXPIRES_IN || "90",
    10
  );
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresInDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const, // Changed from "strict" to "lax"
    secure: process.env.NODE_ENV === "production",
  };

  res.cookie("jwt", token, cookieOptions);
  user.password = undefined;

  res.status(statusCode).json({
    status: "success",
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
};

export const register = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "pembeli",
    });
    createAndSendToken(newUser, 201, res);
  } catch (error) {
    if ((error as any).name === "SequelizeUniqueConstraintError") {
      res
        .status(400)
        .json({ status: "fail", message: "Email sudah terdaftar." });
      return;
    }
    console.error("REGISTER ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const login = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res
        .status(401)
        .json({ status: "fail", message: "Email atau password salah." });
      return;
    }
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const logout = (req: express.Request, res: express.Response): void => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
};

export const logoutAdmin = (
  req: express.Request,
  res: express.Response
): void => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    path: "/", // Ensure the cookie is cleared from the root path
  });
  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
};

export const forgotPassword = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      res.status(404).json({
        status: "fail",
        message: "Tidak ada pengguna dengan alamat email tersebut.",
      });
      return;
    }
    const resetToken = user.createPasswordResetToken();
    await user.save({ validate: false });
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/reset-password.html?token=${resetToken}`;
    const message = `Anda menerima email ini karena Anda (atau orang lain) telah meminta reset password untuk akun Anda.\n\nSilakan klik tautan ini untuk mereset password Anda: ${resetURL}\n\nJika Anda tidak meminta ini, abaikan email ini dan password Anda akan tetap sama.`;
    try {
      await sendEmail({
        email: user.email,
        subject: "Reset Kata Sandi Anda",
        message,
      });
      res.status(200).json({
        status: "success",
        message: "Token reset password telah dikirim ke email Anda.",
      });
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validate: false });
      console.error("EMAIL SENDING ERROR:", emailError);
      res
        .status(500)
        .json({ status: "error", message: (emailError as Error).message });
    }
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const resetPassword = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");
    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: Date.now() },
      },
    });
    if (!user) {
      res.status(400).json({
        status: "fail",
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
      return;
    }
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const loginAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    // Query langsung untuk user dengan role admin untuk efisiensi
    const user = await User.findOne({ where: { email, role: "admin" } });

    // Gabungkan pengecekan user dan password untuk keamanan (mencegah user enumeration)
    if (!user || !(await bcrypt.compare(password, user.password))) {
      res
        .status(401)
        .json({ status: "fail", message: "Email atau password salah." });
      return;
    }
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const forgotPasswordAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email, role: "admin" } });
    if (!user) {
      res.status(200).json({
        status: "success",
        message:
          "Jika email terdaftar, Anda akan menerima instruksi reset password.",
      });
      return;
    }
    const resetToken = user.createPasswordResetToken();
    await user.save({ validate: false });
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/admin/reset-password/${resetToken}`;
    // Di lingkungan produksi, ini harusnya mengirim email.
    // Untuk sekarang, kita log URL untuk keperluan development.
    console.log(`Admin Reset URL: ${resetURL}`);

    // Selalu kembalikan pesan yang sama untuk mencegah user enumeration.
    res.status(200).json({
      status: "success",
      message:
        "Jika email terdaftar, Anda akan menerima instruksi reset password.",
    });
  } catch (error) {
    console.error("ADMIN FORGOT PASSWORD ERROR:", error);
    res.status(200).json({
      status: "success",
      message:
        "Jika email terdaftar, Anda akan menerima instruksi reset password.",
    });
  }
};

export const resetPasswordAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");
    const user = await User.findOne({
      where: {
        passwordResetToken: hashedToken,
        passwordResetExpires: { [Op.gt]: Date.now() },
        role: "admin",
      },
    });
    if (!user) {
      res.status(400).json({
        status: "fail",
        message:
          "Token tidak valid, sudah kedaluwarsa, atau bukan untuk akun admin.",
      });
      return;
    }
    user.password = req.body.password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    // Otomatis loginkan admin setelah reset password berhasil untuk konsistensi UX
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("ADMIN RESET PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};