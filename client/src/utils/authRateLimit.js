export function getRetryAfterSeconds(error) {
  const value = Number(error?.response?.data?.data?.retryAfterSeconds || 0);
  return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
}

export function formatRetryAfter(seconds) {
  const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
  if (safe >= 60) {
    const minutes = Math.ceil(safe / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${safe} second${safe === 1 ? "" : "s"}`;
}
