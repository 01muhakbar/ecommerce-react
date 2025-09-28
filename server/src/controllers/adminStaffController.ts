import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { initializedDbPromise } from "../models/index.js";

const db = await initializedDbPromise;
const { Staff } = db;

const toAvatarUrl = (req: Request, filename?: string | null) => {
  if (!filename) return undefined;
  const base = process.env.BASE_URL ?? `${req.protocol}://${req.get("host")}`;
  return `${base}/uploads/staff/${filename}`;
};

const norm = (v: any): string[] => {
  if (Array.isArray(v)) return v.filter((x: any) => typeof x === "string");
  if (typeof v === "string") {
    try { const j = JSON.parse(v); if (Array.isArray(j)) return j; } catch {}
    return v.split(",").map((s: string) => s.trim()).filter(Boolean);
  }
  if (v && typeof v === "object") return Object.values(v).filter((x: any) => typeof x === "string");
  return [];
};

export async function listStaff(req: Request, res: Response) {
  const q = (req.query.q as string)?.trim().toLowerCase() ?? "";

  const all = await Staff.findAll({ order: [["id", "DESC"]] });
  const filtered = q
    ? all.filter(s =>
        [s.name, s.email, s.contactNumber].some(v => (v ?? "").toLowerCase().includes(q))
      )
    : all;

  res.json(filtered.map(s => ({
    id: s.id,
    name: s.name,
    email: s.email,
    role: s.role,
    routes: norm(s.routes),
    contactNumber: s.contactNumber,
    joiningDate: s.joiningDate,
    avatarUrl: toAvatarUrl(req, s.avatarUrl),
    status: s.status,
    published: s.published,
  })));
}

export async function createStaff(req: Request, res: Response) {
  try {
    const {
      name, email, password, contactNumber, joiningDate, role,
    } = req.body as Record<string, string>;

    const routesRaw = (req.body["routes[]"] ?? req.body["routes"]) as string | string[] | undefined;
    const routes = Array.isArray(routesRaw) ? routesRaw : routesRaw ? [routesRaw] : [];

    if (!name || !email || !password) return res.status(400).json({ message: "name, email, password required" });
    if (!["Super Admin","Admin","Manager","Staff"].includes(role ?? "Staff")) return res.status(400).json({ message: "invalid role" });

    const exists = await Staff.findOne({ where: { email } });
    if (exists) return res.status(409).json({ message: "email already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const filename = (req.file && req.file.filename) || undefined;
    const staff = await Staff.create({
      name,
      email,
      passwordHash,
      contactNumber: contactNumber || null,
      joiningDate: joiningDate || null,
      role: role || "Staff",
      routes,
      avatarUrl: filename,
    });

    res.status(201).json({
      id: staff.id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      routes: norm(staff.routes),
      contactNumber: staff.contactNumber,
      joiningDate: staff.joiningDate,
      avatarUrl: toAvatarUrl(req, staff.avatarUrl),
      status: staff.status,
      published: staff.published,
    });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ message: "failed to create staff" });
  }
}

export async function updateStatus(req: Request, res: Response) {
  const s = await Staff.findByPk(req.params.id);
  if(!s) return res.status(404).json({message:"Not found"});
  const status = req.body.status;
  if (!["Active","Inactive"].includes(status)) return res.status(400).json({message:"invalid status"});
  s.status = status;
  await s.save();
  res.json(s);
}

export async function updatePublishedStatus(req: Request, res: Response) {
  const s = await Staff.findByPk(req.params.id);
  if (!s) return res.status(404).json({ message: "Not found" });

  const published = !!req.body.published;
  s.published = published;

  // sinkronisasi status sesuai kebutuhanmu:
  s.status = published ? "Active" : "Inactive";

  await s.save();
  return res.json(s);
}

export async function getStaff(req: Request, res: Response) {
  const staff = await Staff.findByPk(req.params.id);
  if(!staff) return res.status(404).json({message:"Not found"});
  
  const staffJson = staff.toJSON();
  staffJson.routes = norm(staffJson.routes);
  staffJson.avatarUrl = toAvatarUrl(req, staffJson.avatarUrl);

  res.json(staffJson);
}

export async function updateStaff(req: Request, res: Response) {
  const s = await Staff.findByPk(req.params.id);
  if(!s) return res.status(404).json({message:"Not found"});

  const { name, email, contactNumber, joiningDate, role } = req.body;
  const routesRaw = (req.body["routes[]"] ?? req.body["routes"]) as string | string[] | undefined;
  const routes = Array.isArray(routesRaw) ? routesRaw : routesRaw ? [routesRaw] : s.routes;

  if (name !== undefined) s.name = name;
  if (email !== undefined) s.email = email;
  if (contactNumber !== undefined) s.contactNumber = contactNumber || null;
  if (joiningDate !== undefined) s.joiningDate = joiningDate || null;
  if (role !== undefined) s.role = role;
  if (routes !== undefined) s.routes = routes;
  if (req.file) s.avatarUrl = req.file.filename;

  await s.save();
  
  const staffJson = s.toJSON();
  staffJson.routes = norm(staffJson.routes);
  staffJson.avatarUrl = toAvatarUrl(req, staffJson.avatarUrl);

  res.json(staffJson);
}

export async function deleteStaff(req: Request, res: Response) {
  const count = await Staff.destroy({ where: { id: req.params.id }});
  if(!count) return res.status(404).json({message:"Not found"});
  res.json({ ok: true });
}

export async function changePassword(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Old password and new password are required." });
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