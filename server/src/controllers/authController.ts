import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt, { Secret, SignOptions, JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import { Staff } from "../models/Staff";
import { User } from "../models/User";
import { Op } from "sequelize";
import { normalizeRoleServer } from "../utils/role";

// JWT Types and Constants
interface TokenPayload extends JwtPayload {
  id: number;
  role: string;
}

interface StaffTokenPayload extends TokenPayload {
  email: string;
}

type JwtExpiresIn = string | number;

const jwtConfig = {
  secret: process.env.JWT_SECRET,
  expiresIn: process.env.JWT_EXPIRES || "7d",
  cookieName: process.env.JWT_COOKIE_NAME || "token",
} as const;

const noop = (..._args: any[]) => Promise.resolve();
const allowedAdminRoles = ["Admin", "Super Admin"] as const;

// Default JWT expiration format
const DEFAULT_EXPIRES = "7d" as const;

// Helper function to sign JWT
const signToken = (id: number, role: string): string => {
  if (!jwtConfig.secret) {
    console.error("JWT_SECRET is not defined in environment variables.");
    throw new Error("JWT_SECRET is not defined");
  }

  const payload: TokenPayload = { id, role };

  // Use a known valid expiration format
  const options: SignOptions = {
    expiresIn: DEFAULT_EXPIRES,
  };

  return jwt.sign(payload, jwtConfig.secret as Secret, options);
};

// Helper function to create a token, set a cookie, and send the response
export const createAndSendToken = (
  user: any,
  statusCode: number,
  res: Response
): void => {
  const cookieName = process.env.JWT_COOKIE_NAME || "token"; // Use JWT_COOKIE_NAME
  const token = signToken(user.id, user.role); // This token is for the user, not admin

  const cookieOptions = {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.COOKIE_SECURE === "true", // Use COOKIE_SECURE for more control
  };

  res.cookie(cookieName, token, cookieOptions); // Use cookieName
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
  req: Request,
  res: Response,
  next: NextFunction
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
  req: Request,
  res: Response,
  next: NextFunction
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

export const logout = (req: Request, res: Response): void => {
  const cookieName = process.env.JWT_COOKIE_NAME || "token"; // Use JWT_COOKIE_NAME
  res.clearCookie(cookieName, {
    path: "/",
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.COOKIE_SECURE === "true",
    httpOnly: true,
  });
  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
};

export const adminLogout = (req: Request, res: Response): void => {
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("token", { path: "/" }); // legacy
  res.status(200).json({ ok: true, message: "logged out" });
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction
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
    const resetToken = (user as any).createPasswordResetToken();
    await (user as any).save({ validate: false });
    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/reset-password.html?token=${resetToken}`;
    const message = `Anda menerima email ini karena Anda (atau orang lain) telah meminta reset password untuk akun Anda.\n\nSilakan klik tautan ini untuk mereset password Anda: ${resetURL}\n\nJika Anda tidak meminta ini, abaikan email ini dan password Anda akan tetap sama.`;
    try {
      await noop(user.email, "Reset Kata Sandi Anda", message);
      res.status(200).json({
        status: "success",
        message: "Token reset password telah dikirim ke email Anda.",
      });
    } catch (emailError) {
      (user as any).passwordResetToken = undefined;
      (user as any).passwordResetExpires = undefined;
      await (user as any).save({ validate: false });
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
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  // This function is for regular users, not admin.
  try {
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");
    const user = await User.findOne({
      where: {
        resetToken: hashedToken,
        resetTokenExpires: { [Op.gt]: new Date() },
      },
    });
    if (!user) {
      res.status(400).json({
        status: "fail",
        message: "Token tidak valid atau sudah kedaluwarsa.",
      });
      return;
    }
    (user as any).password = await bcrypt.hash(req.body.password, 12);
    (user as any).passwordResetToken = undefined;
    (user as any).passwordResetExpires = undefined;
    await (user as any).save();
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const adminLogin = async (req: Request, res: Response) => {
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

  function normalizeRoleForToken(raw: string) {
    const s = raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_");
    if (s === "super_admin" || s === "super-admin" || s === "super admin")
      return "super_admin";
    if (s === "admin" || s === "administrator") return "admin";
    return s;
  }

  const normalizedRole = normalizeRoleForToken(staff.role);

  const tokenPayload: StaffTokenPayload = {
    id: staff.id,
    email: staff.email,
    role: normalizedRole,
  };

  // Use the jwtConfig instead of reading env directly
  if (!jwtConfig.secret) {
    return res.status(500).json({ message: "JWT secret not configured" });
  }

  const token = signToken(staff.id, normalizedRole); // bersihkan sisa cookie lama
  res.clearCookie("token", { path: "/" });
  res.clearCookie("access_token", { path: "/" });

  const isProd = process.env.NODE_ENV === "production";
  // set cookie fresh
  res.cookie("access_token", token, {
    httpOnly: true, // Always httpOnly for security
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  return res.status(200).json({
    ok: true,
    user: {
      id: staff.id,
      role: normalizedRole,
      email: staff.email,
      name: staff.name,
    },
  });
};

export const forgotPasswordAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    const resetToken = (user as any).createPasswordResetToken();
    await (user as any).save({ validate: false });

    const resetURL = `${req.protocol}://${req.get(
      "host"
    )}/admin/reset-password/${resetToken}`;
    const message = `Anda menerima email ini karena Anda (atau orang lain) telah meminta reset password untuk akun admin Anda.\n\nSilakan klik tautan ini untuk mereset password Anda: ${resetURL}\n\nJika Anda tidak meminta ini, abaikan email ini dan password Anda akan tetap sama.`;

    try {
      await noop(user.email, "Reset Kata Sandi Admin Anda", message);
    } catch (emailError) {
      console.error("ADMIN EMAIL SENDING ERROR:", emailError);
    }

    res.status(200).json({
      status: "success",
      message:
        "Jika email terdaftar, Anda akan menerima instruksi reset password.",
    });
  } catch (error) {
    console.error("ADMIN FORGOT PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: "Terjadi kesalahan pada server." });
  }
};

export const resetPasswordAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
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
    (user as any).password = await bcrypt.hash(req.body.password, 12);
    (user as any).passwordResetToken = undefined;
    (user as any).passwordResetExpires = undefined;
    await (user as any).save();
    createAndSendToken(user, 200, res);
  } catch (error) {
    console.error("ADMIN RESET PASSWORD ERROR:", error);
    res
      .status(500)
      .json({ status: "error", message: (error as Error).message });
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user?.id) {
      res
        .status(401)
        .json({ message: "Not authenticated or token is missing user ID." });
      return;
    }

    const staff = await Staff.findByPk(user.id);

    if (!staff) {
      res
        .status(401)
        .json({ message: "User for this token no longer exists." });
      return;
    }

    res.status(200).json({
      user: {
        id: staff.id,
        email: staff.email,
        role: normalizeRoleServer(staff.role),
        status: staff.status,
        name: staff.name,
        routes: staff.routes ?? [],
      },
    });
  } catch (error) {
    next(error);
  }
};
