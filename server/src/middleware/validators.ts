import { Request, Response, NextFunction } from "express";
import { z, ZodError } from "zod";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "@ecommerce/schemas";

export const validate =
  (schema: z.ZodObject<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ errors: error.issues });
      }
      next(error);
    }
  };

// Ekspor validator spesifik untuk digunakan di rute
export const validateLogin = validate(loginSchema);
export const validateRegister = validate(registerSchema);
export const validateUpdateProfile = validate(updateProfileSchema);
