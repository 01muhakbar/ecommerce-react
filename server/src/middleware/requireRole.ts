// server/src/middleware/requireRole.ts
import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role;
  if (role !== "admin" && role !== "super_admin") {
    return res.status(403).json({ message: "Forbidden: Admin only" });
  }
  next();
}

// Contoh lain untuk dipakai nanti:
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const role = (req as any).user?.role;
  if (role === "super_admin") return next();
  return res.status(403).json({ message: "Forbidden: Super Admin only" });
}