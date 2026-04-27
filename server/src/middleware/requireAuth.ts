// server/src/middleware/requireAuth.ts
import type { Request, Response, NextFunction } from "express";
import { resolveAuthenticatedUserFromToken } from "../services/authSession.service.js";

const getStorefrontCookieName = () => process.env.AUTH_COOKIE_NAME || "token";
const getAdminCookieName = () =>
  process.env.ADMIN_AUTH_COOKIE_NAME || `${getStorefrontCookieName()}_admin`;

const resolveCookieNameForRequest = (req: Request) => {
  const originalUrl = String(req.originalUrl || "");
  const baseUrl = String(req.baseUrl || "");
  const isAdminRequest =
    originalUrl.startsWith("/api/admin") || baseUrl.startsWith("/api/admin");
  return isAdminRequest ? getAdminCookieName() : getStorefrontCookieName();
};

export default async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if ((req as any).user) {
    return next();
  }

  const token = (req as any).cookies?.[resolveCookieNameForRequest(req)];
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
