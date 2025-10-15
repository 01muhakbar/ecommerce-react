import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Staff } from "../models";
import type { WhereOptions } from "sequelize";

const toAvatarUrl = (req: Request, filename?: string | null) => {
  if (!filename) return undefined;
  const base = process.env.BASE_URL ?? `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/staff/${filename}`;
};

const norm = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter((x: any) => typeof x === "string");
  if (typeof v === "string") {
    try {
      const j = JSON.parse(v);
      if (Array.isArray(j)) return j;
    } catch {}
    return v
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
  }
  if (v && typeof v === "object")
    return Object.values(v).filter((x: any) => typeof x === "string");
  return [];
};

export async function listStaff(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim().toLowerCase() ?? "";

  const all = await Staff.findAll({ order: [["id", "DESC"]] });
  const filtered: Staff[] = q
    ? all.filter((s) =>
        [s.name, s.email].some((v) => (v ?? "").toLowerCase().includes(q))
      )
    : all;

  res.json(
    filtered.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      role: s.role,
    }))
  );
}

export async function createStaff(req: Request, res: Response) {
  try {
    const { name, email, password, role } = req.body as Record<string, string>;

    const routesRaw = (req.body["routes[]"] ?? req.body["routes"]) as
      | string
      | string[]
      | undefined;
    const routes = Array.isArray(routesRaw)
      ? routesRaw
      : routesRaw
      ? [routesRaw]
      : [];

    if (!name || !email || !password)
      return res
        .status(400)
        .json({ message: "name, email, password required" });

    // Normalize incoming role strings to Staff model enum
    const roleRaw = (role ?? "Staff") as string;
    const roleMap: Record<string, Staff["role"]> = {
      "super admin": "super_admin",
      super_admin: "super_admin",
      admin: "admin",
      administrator: "admin",
      manager: "editor",
      staff: "viewer",
    };
    const normalizedRole = roleMap[roleRaw.toLowerCase().trim()] ?? "viewer";

    const exists = await Staff.findOne({ where: { email } as WhereOptions });
    if (exists)
      return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const staff = await Staff.create({
      name,
      email,
      passwordHash,
      role: normalizedRole,
      routes,
    });

    res.status(201).json({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      routes: norm(staff.routes),
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: "failed to create staff" });
  }
}

export async function updateStatus(req: Request, res: Response) {
  const s = await Staff.findByPk(req.params.id);
  if (!s) return res.status(404).json({ message: "Not found" });
  // status handling removed (not present on model)
  res.json(s);
}

export async function updatePublishedStatus(req: Request, res: Response) {
  const s = await Staff.findByPk(req.params.id);
  if (!s) return res.status(404).json({ message: "Not found" });

  // published handling removed (not present on model)
  return res.json(s);
}

export async function getStaff(req: Request, res: Response) {
  const staff = await Staff.findByPk(req.params.id);
  if (!staff) return res.status(404).json({ message: "Not found" });

  res.json(staff.toJSON());
}

export async function updateStaff(req: Request, res: Response) {
  const s = await Staff.findByPk(req.params.id);
  if (!s) return res.status(404).json({ message: "Not found" });

  const { name, email, role } = req.body;

  if (name !== undefined) s.name = name;
  if (email !== undefined) s.email = email;
  if (role !== undefined) s.role = role;

  await s.save();

  res.json(s.toJSON());
}

export async function deleteStaff(req: Request, res: Response) {
  const count = await Staff.destroy({ where: { id: req.params.id } });
  if (!count) return res.status(404).json({ message: "Not found" });
  res.json({ ok: true });
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Old password and new password are required." });
    }

    const staff = await Staff.findByPk(id);
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }

    const isMatch = await bcrypt.compare(oldPassword, staff.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect old password." });
    }

    staff.passwordHash = await bcrypt.hash(newPassword, 10);
    await staff.save();

    res.status(200).json({ message: "Password updated successfully." });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: "Failed to change password." });
  }
}
