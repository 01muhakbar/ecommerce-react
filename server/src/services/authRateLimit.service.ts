const rateLimitBuckets = new Map<string, number[]>();

export class AuthRateLimitError extends Error {
  status: number;
  code: string;
  retryAfterSeconds: number;

  constructor(input: { message?: string; retryAfterSeconds: number }) {
    super(input.message || "Please wait before trying again.");
    this.status = 429;
    this.code = "RATE_LIMITED";
    this.retryAfterSeconds = input.retryAfterSeconds;
  }
}

export function consumeAuthRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const timestamps = (rateLimitBuckets.get(key) || []).filter((value) => now - value < windowMs);
  if (timestamps.length >= limit) {
    const retryAfterMs = Math.max(windowMs - (now - timestamps[0]), 1000);
    rateLimitBuckets.set(key, timestamps);
    return {
      limited: true,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }
  timestamps.push(now);
  rateLimitBuckets.set(key, timestamps);
  return {
    limited: false,
    retryAfterSeconds: 0,
  };
}

export function enforceAuthRateLimit(key: string, limit: number, windowMs: number) {
  const result = consumeAuthRateLimit(key, limit, windowMs);
  if (result.limited) {
    throw new AuthRateLimitError({
      retryAfterSeconds: result.retryAfterSeconds,
    });
  }
}
