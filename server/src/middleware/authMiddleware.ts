import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User as UserModel } from "../models/User.js"; // FIX: Renamed import to UserModel to avoid local scope conflict.
import { AppError } from "./errorMiddleware.js";

// Extend Express Request type to include the user property
export interface CustomRequest extends Request {
  user?: UserModel;
}

// FIX: The return type is changed from 'void' to 'Promise<void | Response>'
// This allows the function to either call next() (void) or send a response directly.
export const protect = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): void | Response => {
  console.log("Cookies received by protect middleware:", req.cookies);
  const token = req.cookies?.token;
  if (!token) return res.sendStatus(401);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.user = payload;
    return next();
  } catch {
    return res.sendStatus(401);
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    const userRole = (req.user?.role || '').toLowerCase();
    const allowed = roles.map(r => r.toLowerCase());
    if (!allowed.includes(userRole)) {
      // Return a standard 403 Forbidden response
      return res.status(403).json({ 
        status: 'fail',
        message: 'You do not have permission to perform this action' 
      });
    }
    next();
  };
};