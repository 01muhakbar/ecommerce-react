import type { Request, Response } from "express";
import { QueryTypes } from "sequelize";
import { sequelize } from "../../models/index.js";

type ProfileRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  avatar: string | null;
  avatarUrl: string | null;
};

type UsersTableMeta = {
  tableName: string;
  updatedColumn: string | null;
  phoneColumn: string | null;
  avatarColumn: string | null;
};

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
let cachedMeta: UsersTableMeta | null = null;

const quoteId = (value: string) => {
  if (!IDENTIFIER_RE.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
};

const resolveUsersTableName = async (): Promise<string | null> => {
  const queryInterface = sequelize.getQueryInterface();
  for (const candidate of ["users", "Users"]) {
    try {
      await queryInterface.describeTable(candidate);
      return candidate;
    } catch {
      // continue
    }
  }
  return null;
};

const pickFirstExistingColumn = (
  tableDesc: Record<string, unknown>,
  candidates: string[]
): string | null => {
  for (const candidate of candidates) {
    if (Object.prototype.hasOwnProperty.call(tableDesc, candidate)) {
      return candidate;
    }
  }
  return null;
};

const getUsersTableMeta = async (): Promise<UsersTableMeta> => {
  if (cachedMeta) return cachedMeta;
  const queryInterface = sequelize.getQueryInterface();
  const tableName = await resolveUsersTableName();
  if (!tableName) {
    throw new Error("Users table not found");
  }

  const tableDesc = (await queryInterface.describeTable(tableName)) as Record<string, unknown>;
  cachedMeta = {
    tableName,
    updatedColumn: pickFirstExistingColumn(tableDesc, ["updated_at", "updatedAt"]),
    phoneColumn: pickFirstExistingColumn(tableDesc, ["phone", "phone_number", "phoneNumber"]),
    avatarColumn: pickFirstExistingColumn(tableDesc, ["avatar", "avatar_url", "avatarUrl"]),
  };
  return cachedMeta;
};

const toProfile = async (userId: number): Promise<ProfileRow | null> => {
  const meta = await getUsersTableMeta();
  const phoneSelect = meta.phoneColumn
    ? `${quoteId(meta.phoneColumn)} AS phone`
    : "NULL AS phone";
  const avatarSelect = meta.avatarColumn
    ? `${quoteId(meta.avatarColumn)} AS avatar, ${quoteId(meta.avatarColumn)} AS avatarUrl`
    : "NULL AS avatar, NULL AS avatarUrl";

  const rows = await sequelize.query<ProfileRow>(
    `
      SELECT
        id,
        name,
        email,
        ${phoneSelect},
        ${avatarSelect}
      FROM ${quoteId(meta.tableName)}
      WHERE id = :id
      LIMIT 1
    `,
    {
      replacements: { id: userId },
      type: QueryTypes.SELECT,
    }
  );

  return rows[0] || null;
};

const getCurrentUserId = (req: Request): number | null => {
  const rawId = Number((req as any)?.user?.id);
  return Number.isFinite(rawId) ? rawId : null;
};

export const getAdminMe = async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const profile = await toProfile(userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[admin.me][GET] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch profile" });
  }
};

export const updateAdminMe = async (req: Request, res: Response) => {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const name = String(req.body?.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const meta = await getUsersTableMeta();
    const updates: string[] = ["name = :name"];
    const replacements: Record<string, unknown> = { id: userId, name };

    if (meta.phoneColumn && Object.prototype.hasOwnProperty.call(req.body || {}, "phone")) {
      const phoneRaw = req.body?.phone;
      const phone =
        phoneRaw == null || String(phoneRaw).trim() === "" ? null : String(phoneRaw).trim();
      updates.push(`${quoteId(meta.phoneColumn)} = :phone`);
      replacements.phone = phone;
    }

    if (
      meta.avatarColumn &&
      (Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl") ||
        Object.prototype.hasOwnProperty.call(req.body || {}, "avatar"))
    ) {
      const avatarRaw = Object.prototype.hasOwnProperty.call(req.body || {}, "avatarUrl")
        ? req.body?.avatarUrl
        : req.body?.avatar;
      const avatar =
        avatarRaw == null || String(avatarRaw).trim() === "" ? null : String(avatarRaw).trim();
      updates.push(`${quoteId(meta.avatarColumn)} = :avatarUrl`);
      replacements.avatarUrl = avatar;
    }

    if (meta.updatedColumn) {
      updates.push(`${quoteId(meta.updatedColumn)} = NOW()`);
    }

    await sequelize.query(
      `
        UPDATE ${quoteId(meta.tableName)}
        SET ${updates.join(", ")}
        WHERE id = :id
      `,
      { replacements, type: QueryTypes.UPDATE }
    );

    const profile = await toProfile(userId);
    if (!profile) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, data: profile });
  } catch (error) {
    console.error("[admin.me][PUT] failed:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};
