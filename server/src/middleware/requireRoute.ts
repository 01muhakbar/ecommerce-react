import { Request, Response, NextFunction } from "express";

export function requireRoute(_req: Request, _res: Response, next: NextFunction) {
  // TODO: implementasikan ulang jika butuh daftar route.
  next();
}
