import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User } from "../models/User.js";
import { Staff } from "../models/Staff.js";
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

  res.cookie("token", token, cookieOptions);
  user.password = undefined;

  res.status(statusCode).json({
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
  res.clearCookie("token", { 
    path: "/", 
    sameSite: "lax", 
    secure: process.env.NODE_ENV === "production", 
    httpOnly: true 
  });
  res.status(200).json({ status: "success", message: "Logged out successfully" });
};

export const adminLogout = (req: express.Request, res: express.Response): void => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  res.status(200).json({ ok: true });
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

import { Staff } from "../models/Staff.js";

export const adminLogin = async (req: express.Request, res: express.Response) => {
  const { email, password } = req.body as { email: string; password: string };
  const staff = await Staff.findOne({ where: { email } });
  if (!staff) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const ok = await bcrypt.compare(password, staff.passwordHash);
  if (!ok) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  if (staff.status !== "Active") {
    return res.status(403).json({ message: "Account inactive" });
  }

  const token = jwt.sign(
    { id: staff.id, role: staff.role, email: staff.email },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" }
  );

  res.cookie("token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === 'production',  // set true jika pakai HTTPS
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  // jangan kirim token di body
  return res.status(200).json({ ok: true, user: { id: staff.id, role: staff.role, email: staff.email } });
}

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
  try {
    // req.user is the JWT payload, contains id
    if (!req.user?.id) {
      res.status(401).json({ message: "Not authenticated or token is missing user ID." });
      return;
    }

    // Fetch the full, fresh user data from the database
    const staff = await Staff.findByPk(req.user.id);

    if (!staff) {
      res.status(401).json({ message: "User for this token no longer exists." });
      return;
    }

    // Return the flat user object as requested
    res.status(200).json({
      id: staff.id,
      email: staff.email,
      role: staff.role,
      status: staff.status,
      name: staff.name, // also include name, it's useful
      routes: staff.routes ?? [],
    });

  } catch (error) {
    next(error);
  }
};

