import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "X-Request-Id";
const CORRELATION_ID_HEADER = "X-Correlation-Id";
const MAX_REQUEST_ID_LENGTH = 120;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

const normalizeHeaderValue = (value: unknown) => {
  const firstValue = Array.isArray(value) ? value[0] : value;
  const normalized = String(firstValue || "").trim();
  if (!normalized || normalized.length > MAX_REQUEST_ID_LENGTH) return null;
  if (!SAFE_REQUEST_ID_PATTERN.test(normalized)) return null;
  return normalized;
};

const buildRequestId = () => `req_${randomUUID()}`;

type RequestWithRequestId = Request & {
  requestId?: string;
  correlationId?: string;
  requestIdSource?: "x-request-id" | "x-correlation-id" | "generated";
};

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const requestIdHeader = normalizeHeaderValue(req.headers["x-request-id"]);
  const correlationIdHeader = normalizeHeaderValue(req.headers["x-correlation-id"]);
  const requestId = requestIdHeader || correlationIdHeader || buildRequestId();
  const correlationId = correlationIdHeader || requestId;
  const request = req as RequestWithRequestId;

  request.requestId = requestId;
  request.correlationId = correlationId;
  request.requestIdSource = requestIdHeader
    ? "x-request-id"
    : correlationIdHeader
      ? "x-correlation-id"
      : "generated";

  res.setHeader(REQUEST_ID_HEADER, requestId);
  res.setHeader(CORRELATION_ID_HEADER, correlationId);
  next();
};
