const AUTH_SESSION_NOTICE_KEY = "authSessionNotice";

export const DEFAULT_SESSION_EXPIRED_NOTICE =
  "Your session is no longer valid. Sign in again to continue.";

function normalizeNotice(value) {
  const text = String(value || "").trim();
  return text;
}

export function storePendingAuthNotice(message) {
  try {
    const normalized = normalizeNotice(message) || DEFAULT_SESSION_EXPIRED_NOTICE;
    sessionStorage.setItem(AUTH_SESSION_NOTICE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
}

export function readPendingAuthNotice() {
  try {
    return normalizeNotice(sessionStorage.getItem(AUTH_SESSION_NOTICE_KEY) || "");
  } catch {
    return "";
  }
}

export function clearPendingAuthNotice() {
  try {
    sessionStorage.removeItem(AUTH_SESSION_NOTICE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function resolveUnauthorizedNotice(payload) {
  const code = String(payload?.code || "").trim().toUpperCase();
  const status = Number(payload?.status || 0);
  const message = String(payload?.message || "").trim();

  if (code === "ACCOUNT_NOT_ACTIVE") {
    return "Your account is not active right now. Sign in again after the account becomes available.";
  }

  if (code === "VERIFICATION_REQUIRED") {
    return "Verify your email before signing in.";
  }

  if (status === 401 || status === 403) {
    return DEFAULT_SESSION_EXPIRED_NOTICE;
  }

  return normalizeNotice(message) || DEFAULT_SESSION_EXPIRED_NOTICE;
}
