import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// --- INTERFACES ---

interface JwtPayload {
  id: number;
  role: string;
}

interface CustomRequest extends Request {
  user?: JwtPayload;
}

// --- MIDDLEWARE ---

/**
 * Middleware untuk memverifikasi token JWT.
 */
export const isAuth = (req: CustomRequest, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    res.status(401).json({ message: "Authentication token is required." });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET || '', (err: any, decoded: any) => {
    if (err) {
      res.status(401).json({ message: "Invalid or expired token." });
      return;
    }

    req.user = decoded as JwtPayload;
    next();
  });
};

/**
 * Middleware untuk memverifikasi peran user.
 */
export const hasRole = (...roles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(403).json({ message: "Forbidden: User not authenticated." });
      return;
    }

    if (roles.includes(req.user.role)) {
      next();
      return;
    }

    res.status(403).json({
      message: "Forbidden: You do not have the required role to access this resource.",
    });
  };
};