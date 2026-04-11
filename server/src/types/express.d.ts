// server/src/types/express.d.ts
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: number;
      email?: string;
      role?: string;
    };
    requestId?: string;
    correlationId?: string;
    requestIdSource?: "x-request-id" | "x-correlation-id" | "generated";
  }
}
