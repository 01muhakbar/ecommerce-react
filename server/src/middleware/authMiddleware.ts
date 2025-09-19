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
export const protect = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    const message = "You are not logged in! Please log in to get access.";
    // FIX: This return is now valid because of the updated function signature.
    return next(new AppError(message, 401));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      id: number;
    };

    const currentUser = await UserModel.findByPk(decoded.id);

    if (!currentUser) {
      const message = "The user belonging to this token does no longer exist.";
      return next(new AppError(message, 401));
    }

    req.user = currentUser;
    next();
  } catch (err) {
    const message = "Invalid token. Please log in again.";
    return next(new AppError(message, 401));
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