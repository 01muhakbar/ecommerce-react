import { Request, Response, NextFunction } from "express";
import { resolveAuthenticatedUserFromToken } from "../services/authSession.service.js";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> | Response => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.sendStatus(401);
  return resolveAuthenticatedUserFromToken(token)
    .then((session) => {
      if (!session) {
        return res.sendStatus(401);
      }
      (req as any).user = {
        ...session.payload,
        id: session.authUser.id,
        email: session.authUser.email,
        name: session.authUser.name,
        role: session.authUser.role,
        status: session.authUser.status,
      };
      return next();
    })
    .catch(() => res.sendStatus(401));
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = ((req as any).user?.role || '').toLowerCase();
    const allowed = roles.map(r => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      return res.status(403).json({ 
        status: 'fail',
        message: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};
