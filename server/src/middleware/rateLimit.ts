import type { Request, RequestHandler } from "express";
import { consumeAuthRateLimit } from "../services/authRateLimit.service.js";

type RateLimitOptions = {
  name: string;
  limit: number;
  windowMs: number;
  includeUser?: boolean;
};

const isDisabled = () =>
  ["true", "1", "yes", "on"].includes(
    String(process.env.RATE_LIMIT_DISABLED || "").trim().toLowerCase()
  );

const getClientIp = (req: Request) =>
  String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim() ||
  req.ip ||
  "unknown";

const getActorKey = (req: Request, includeUser: boolean) => {
  const userId = Number((req as any)?.user?.id);
  if (includeUser && Number.isFinite(userId) && userId > 0) {
    return `user:${userId}`;
  }
  return `ip:${getClientIp(req)}`;
};

const getEffectiveLimit = (limit: number) => {
  if (process.env.NODE_ENV === "production") return limit;
  const multiplier = Number(process.env.RATE_LIMIT_NON_PRODUCTION_MULTIPLIER || 5);
  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 5;
  return Math.max(limit, Math.floor(limit * safeMultiplier));
};

export const createRateLimit = (options: RateLimitOptions): RequestHandler => {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowMs = Math.max(1000, Math.floor(options.windowMs));
  const name = String(options.name || "route").trim() || "route";

  return (req, res, next) => {
    if (isDisabled()) {
      return next();
    }

    const key = `route:${name}:${getActorKey(req, Boolean(options.includeUser))}`;
    const result = consumeAuthRateLimit(key, getEffectiveLimit(limit), windowMs);
    if (!result.limited) {
      return next();
    }

    res.setHeader("Retry-After", String(result.retryAfterSeconds));
    return res.status(429).json({
      success: false,
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      data: {
        retryAfterSeconds: result.retryAfterSeconds,
      },
    });
  };
};

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export const cartMutationRateLimit = createRateLimit({
  name: "cart-mutation",
  limit: 60,
  windowMs: FIFTEEN_MINUTES_MS,
  includeUser: true,
});

export const checkoutPreviewRateLimit = createRateLimit({
  name: "checkout-preview",
  limit: 60,
  windowMs: FIFTEEN_MINUTES_MS,
  includeUser: true,
});

export const checkoutSubmitRateLimit = createRateLimit({
  name: "checkout-submit",
  limit: 10,
  windowMs: FIFTEEN_MINUTES_MS,
  includeUser: true,
});

export const paymentMutationRateLimit = createRateLimit({
  name: "payment-mutation",
  limit: 10,
  windowMs: FIFTEEN_MINUTES_MS,
  includeUser: true,
});

export const publicTrackingRateLimit = createRateLimit({
  name: "public-tracking",
  limit: 120,
  windowMs: FIFTEEN_MINUTES_MS,
});

export const couponQuoteRateLimit = createRateLimit({
  name: "coupon-quote",
  limit: 60,
  windowMs: FIFTEEN_MINUTES_MS,
});

export const stripeSessionRateLimit = createRateLimit({
  name: "stripe-session",
  limit: 30,
  windowMs: FIFTEEN_MINUTES_MS,
  includeUser: true,
});

export const stripeWebhookRateLimit = createRateLimit({
  name: "stripe-webhook",
  limit: 120,
  windowMs: FIFTEEN_MINUTES_MS,
});
