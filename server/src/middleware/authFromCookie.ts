// server/src/middleware/authFromCookie.ts
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

export default async function authFromCookie(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      (req as any).cookies?.[resolveCookieNameForRequest(req)] ||
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
