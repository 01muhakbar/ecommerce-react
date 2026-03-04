import type { Request, Response } from "express";
import { sequelize, User } from "../../models/index.js";

type UserColumnSupport = {
  checked: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
};

const userColumns: UserColumnSupport = {
  checked: false,
  hasPhone: false,
  hasAddress: false,
};

const getAuthUserId = (req: Request) => {
  const userId = Number((req as any)?.user?.id);
  return Number.isFinite(userId) && userId > 0 ? userId : 0;
};

const toText = (value: unknown) => String(value ?? "").trim();

const toNullableText = (value: unknown) => {
  const text = toText(value);
  return text || null;
};

const ensureUserColumns = async () => {
  if (userColumns.checked) return userColumns;
  try {
    const table = await sequelize.getQueryInterface().describeTable("users");
    userColumns.hasPhone = Object.prototype.hasOwnProperty.call(table, "phone");
    userColumns.hasAddress = Object.prototype.hasOwnProperty.call(table, "address");
  } catch {
    userColumns.hasPhone = false;
    userColumns.hasAddress = false;
  } finally {
    userColumns.checked = true;
  }
  return userColumns;
};

const getUserPayload = (user: any, support: UserColumnSupport) => {
  const payload: Record<string, unknown> = {
    id: Number(user?.get?.("id") ?? user?.id ?? 0),
    name: toText(user?.get?.("name") ?? user?.name ?? ""),
    email: toText(user?.get?.("email") ?? user?.email ?? ""),
    phone: support.hasPhone
      ? toNullableText(user?.get?.("phone") ?? user?.phone ?? null)
      : null,
  };
  if (support.hasAddress) {
    payload.address = toNullableText(user?.get?.("address") ?? user?.address ?? null);
  }
  return payload;
};

const findUserMe = async (userId: number, support: UserColumnSupport) => {
  const attrs = ["id", "name", "email"];
  if (support.hasPhone) attrs.push("phone");
  if (support.hasAddress) attrs.push("address");
  return User.findByPk(userId, { attributes: attrs as any[] });
};

export const getUserMe = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const support = await ensureUserColumns();
    const user = await findUserMe(userId, support);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      data: getUserPayload(user, support),
    });
  } catch (error) {
    console.error("[user/me][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to load profile" });
  }
};

export const updateUserMe = async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const name = toText(req.body?.name);
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const support = await ensureUserColumns();
    const user = await findUserMe(userId, support);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const updates: Record<string, unknown> = { name };
    if (support.hasPhone && Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
      updates.phone = toNullableText(req.body?.phone);
    }
    await user.update(updates as any);

    const refreshed = await findUserMe(userId, support);
    if (!refreshed) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      data: getUserPayload(refreshed, support),
    });
  } catch (error) {
    console.error("[user/me][PUT] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};
