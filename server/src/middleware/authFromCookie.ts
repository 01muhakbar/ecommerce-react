// server/src/middleware/authFromCookie.ts
import type { Request, Response, NextFunction } from "express";
import { resolveAuthenticatedUserFromToken } from "../services/authSession.service.js";

// Canonical auth cookie name via AUTH_COOKIE_NAME.
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";

export default async function authFromCookie(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      (req as any).cookies?.[COOKIE_NAME] ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : undefined);

    (req as any).user = null;

    if (token) {
      const session = await resolveAuthenticatedUserFromToken(token);
      (req as any).user = session?.authUser ?? null;
    }
  } catch {
    (req as any).user = null;
  }
  next();
}
