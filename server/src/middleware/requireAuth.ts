// server/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";

function normalizeRole(input: unknown) {
  const raw = String(input ?? "").toLowerCase().trim();
  if (!raw) return null;
  const snake = raw.replace(/[^a-z0-9]+/g, "_");
  if (["super_admin", "super-admin", "super admin", "superadmin"].includes(raw) || snake === "super_admin") {
    return "super_admin";
  }
  if (["admin", "administrator"].includes(raw) || snake === "admin") {
    return "admin";
  }
  if (["staf", "staff"].includes(raw) || snake === "staf" || snake === "staff") {
    return "staff";
  }
  return snake;
}

export default function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user) {
    return next();
  }

  const token = (req as any).cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const payload: any = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
    const rawRole = payload.role || payload.userRole || payload["https://example.com/role"];
    const role = normalizeRole(rawRole);
    (req as any).user = {
      id: payload.id ?? payload.userId ?? payload.sub,
      email: payload.email,
      name: payload.name,
      role,
    };
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}
