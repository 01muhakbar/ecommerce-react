// server/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import { resolveAuthenticatedUserFromToken } from "../services/authSession.service.js";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";

export default async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user) {
    return next();
  }

  const token = (req as any).cookies?.[COOKIE_NAME];
  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  try {
    const session = await resolveAuthenticatedUserFromToken(token);
    if (!session) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    (req as any).user = session.authUser;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}
