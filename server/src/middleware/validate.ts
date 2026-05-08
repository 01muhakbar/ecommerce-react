import { Request, Response, NextFunction } from "express";
type ParseableSchema = { parse: (input: unknown) => unknown };

const validate =
  (schema: ParseableSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (e: any) {
      const errors = e.errors.map((error: any) => ({
        path: error.path.join("."),
        message: error.message,
      }));
      return res.status(400).json({ status: "fail", errors });
    }
  };

export default validate;
