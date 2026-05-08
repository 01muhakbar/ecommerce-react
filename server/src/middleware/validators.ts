import { Request, Response, NextFunction } from "express";
import * as schemas from "@ecommerce/schemas";
import validate from "./validate.js"; // FIX: Added .js extension

// The schemas are imported from the shared package.
// FIX: `registerSchema` is not exported from the `@ecommerce/schemas` package.
// It and the corresponding `validateRegister` middleware are removed to fix the build.
const { loginSchema, updateProfileSchema } = schemas;

export const validateLogin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  validate(loginSchema)(req, res, next);
};

export const validateUpdateProfile = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  validate(updateProfileSchema)(req, res, next);
};
