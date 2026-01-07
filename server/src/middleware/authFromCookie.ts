// server/src/middleware/authFromCookie.ts
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";

function normalizeRole(input: unknown) {
  const raw = String(input ?? "").toLowerCase().trim();
  if (!raw) return null;
  const snake = raw.replace(/[^a-z0-9]+/g, "_");
  if (["super_admin", "super-admin", "super admin"].includes(raw) || snake === "super_admin") {
    return "super_admin";
  }
  if (["admin", "administrator"].includes(raw) || snake === "admin") {
    return "admin";
  }
  return snake;
}

export default function authFromCookie(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      (req as any).cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);

    (req as any).user = null;

    if (token) {
      const payload: any = jwt.verify(token, process.env.JWT_SECRET || "dev-secret");
      const rawRole = payload.role || payload.userRole || payload["https://example.com/role"];
      const role = normalizeRole(rawRole);
      (req as any).user = {
        id: payload.id ?? payload.userId ?? payload.sub,
        email: payload.email,
        name: payload.name,
        role,
      };
    }
  } catch {
    (req as any).user = null;
  }
  next();
}
