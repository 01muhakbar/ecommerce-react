import { Request, Response, NextFunction } from "express";

// ganti dengan real auth, ini hanya placeholder:
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // misal req.user diset oleh JWT middleware
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: "Unauthenticated" });
  if (!["Admin", "Super Admin"].includes(user.role)) return res.status(403).json({ message: "Forbidden" });
  next();
}
