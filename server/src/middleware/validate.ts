import { Request, Response, NextFunction } from "express";
import { ZodError, ZodIssue, ZodSchema } from "zod";

const validate =
  (schema: ZodSchema) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err: ZodIssue) => ({
          message: err.message,
          path: err.path,
        }));
        return res.status(400).json({ errors: formattedErrors });
      }
      // Handle non-Zod errors
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };

export default validate;
