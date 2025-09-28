import { Request, Response, NextFunction } from "express";
import { CustomRequest } from "./authMiddleware";

export const requireRoute = (key: string) => (req: CustomRequest, res: Response, next: NextFunction) => {
  const u = req.user;
  if (u?.role === "Super Admin") return next();  // BYPASS
  if (Array.isArray(u?.routes) && u.routes.includes(key)) return next();
  return res.status(403).json({ message: "Forbidden" });
};