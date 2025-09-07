import { Request, Response, NextFunction } from "express";

export const isAuth = (req: Request, res: Response, next: NextFunction) => {
  // This is a dummy implementation to resolve the import in api.ts
  console.log("isAuth middleware called");
  next();
};
