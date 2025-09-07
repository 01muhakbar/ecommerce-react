import express from 'express';
import bcrypt from "bcryptjs";
import initializedDbPromise from "../models/index.js";

interface CustomRequest extends express.Request {
  // @ts-ignore
  user?: {
    id: number;
    role: string;
  };
}

const db = await initializedDbPromise;
const { User } = db;

export const getMe = async (
  req: CustomRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Seharusnya tidak terjadi jika middleware isAuth bekerja
      return res.status(401).json({ message: "Not authorized" });
    }

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "role"],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
};

// --- ADMIN FUNCTIONS ---

/**
 * Mendapatkan semua pengguna (Admin only).
 */
export const getAllUsers = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
      order: [["createdAt", "DESC"]],
    });
    res
      .status(200)
      .json({ status: "success", results: users.length, data: users });
  } catch (error) {
    next(error);
  }
};

/**
 * Mendapatkan satu pengguna berdasarkan ID (Admin only).
 */
export const getUserById = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json({ status: "success", data: user });
  } catch (error) {
    next(error);
  }
};

/**
 * Membuat pengguna baru (Admin only).
 */
export const createUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const { name, email, password, role } = req.body;
    const hashedPassword = await bcrypt.hash(password, 12);
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "pembeli",
    });
    (newUser as any).password = undefined;
    res.status(201).json({ status: "success", data: newUser });
  } catch (error) {
    if ((error as any).name === "SequelizeUniqueConstraintError") {
      return res
        .status(400)
        .json({ status: "fail", message: "Email sudah terdaftar." });
    }
    next(error);
  }
};

/**
 * Memperbarui pengguna (Admin only).
 */
export const updateUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const [updatedRows] = await User.update(req.body, {
      where: { id: req.params.id },
    });
    if (updatedRows === 0) {
      return res.status(404).json({ message: "User not found to update." });
    }
    const updatedUser = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });
    res.status(200).json({ status: "success", data: updatedUser });
  } catch (error) {
    next(error);
  }
};

/**
 * Menghapus pengguna (Admin only).
 */
export const deleteUser = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const deletedRows = await User.destroy({ where: { id: req.params.id } });
    if (deletedRows === 0) {
      return res.status(404).json({ message: "User not found to delete." });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (
  req: CustomRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { name } = req.body;

    const [updatedRows] = await User.update(
      { name },
      { where: { id: userId } }
    );

    if (updatedRows === 0) {
      return res.status(404).json({ message: "User not found to update." });
    }

    const updatedUser = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "role"],
    });

    res.status(200).json({ status: "success", data: updatedUser });
  } catch (error) {
    next(error);
  }
};