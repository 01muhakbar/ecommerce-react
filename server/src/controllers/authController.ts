import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
// import sendEmail from "../services/emailService.js"; // Replaced with dynamic import
import { Op } from "sequelize";
import { CustomRequest } from "../middleware/authMiddleware.js";

const allowedAdminRoles = ["Admin", "Super Admin"] as const;

// Helper function to sign JWT
const signToken = (id: number, role: string): string => {
  const secret = process.env.JWT_SECRET as string;
  if (!secret) {
    throw new Error("JWT_SECRET is not defined");
  }
  // Payload sekarang menyertakan lebih banyak detail jika diperlukan, tapi id dan role adalah yang utama.
  const payload = { id, role };
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// Helper function to create a token, set a cookie, and send the response
export const createAndSendToken = (
  user: any,
  statusCode: number,
  res: express.Response
): void => {
  const token = signToken(user.id, user.role); // Menggunakan helper yang sudah ada

  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 hari dalam milidetik
    httpOnly: true,
    // secure: process.env.NODE_ENV === "production", // Aktifkan di produksi dengan HTTPS
    path: "/",
    sameSite: "lax" as const,
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
    if (!user || !(await bcrypt.compare(password, user.password!))) {
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
      // Dynamically import sendEmail only when needed
      const { default: sendEmail } = await import(
        "../services/emailService.js"
      );
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
    user.password = await bcrypt.hash(req.body.password, 12);
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

export const adminLogin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });

    // Cek user dan password dalam satu langkah untuk keamanan
    if (!user || !(await bcrypt.compare(password, user.password!))) {
      res.status(401).json({ status: "fail", message: "Invalid credentials" });
      return;
    }

    // Cek apakah role diizinkan untuk login admin
    if (!allowedAdminRoles.includes(user.role as any)) {
      res
        .status(403)
        .json({ status: "fail", message: `Forbidden for role ${user.role}` });
      return;
    }

    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("ADMIN LOGIN ERROR:", error);
    // Menggunakan next(error) untuk penanganan error terpusat
    next(error);
  }
};

export const forgotPasswordAdmin = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    const { email } = req.body;
    const user = await User.findOne({
      where: { email, role: { [Op.in]: [...allowedAdminRoles] } },
    });
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
    const message = `Anda menerima email ini karena Anda (atau orang lain) telah meminta reset password untuk akun admin Anda.\n\nSilakan klik tautan ini untuk mereset password Anda: ${resetURL}\n\nJika Anda tidak meminta ini, abaikan email ini dan password Anda akan tetap sama.`;

    try {
      const { default: sendEmail } = await import(
        "../services/emailService.js"
      );
      await sendEmail({
        email: user.email,
        subject: "Reset Kata Sandi Admin Anda",
        message,
      });
    } catch (emailError) {
      // Even if email fails, don't reveal that the user exists.
      // Log the error for debugging, but send a generic response.
      console.error("ADMIN EMAIL SENDING ERROR:", emailError);
    }

    // Always return the same message to prevent user enumeration
    res
      .status(200)
      .json({
        status: "success",
        message:
          "Jika email terdaftar, Anda akan menerima instruksi reset password.",
      });
  } catch (error) {
    console.error("ADMIN FORGOT PASSWORD ERROR:", error);
    // On a server error, it's better to send a 500 status
    res
      .status(500)
      .json({ status: "error", message: "Terjadi kesalahan pada server." });
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
        role: { [Op.in]: [...allowedAdminRoles] },
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
    user.password = await bcrypt.hash(req.body.password, 12);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("ADMIN RESET PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const getMe = async (
  req: CustomRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  // Asumsi middleware 'protect' sudah menaruh user di res.locals.user
  const user = req.user;

  if (!user) {
    res.status(401).json({ status: "fail", message: "Not logged in" });
    return;
  }

  res.status(200).json({
    status: "success",
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
};

