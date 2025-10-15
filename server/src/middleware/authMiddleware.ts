import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User as UserModel } from "../models/User";
import { AppError } from "./errorMiddleware";

export const protect = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  console.log("Cookies received by protect middleware:", req.cookies);
  const token = req.cookies?.token;
  if (!token) return res.sendStatus(401);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    (req as any).user = payload;
    return next();
  } catch {
    return res.sendStatus(401);
  }
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
