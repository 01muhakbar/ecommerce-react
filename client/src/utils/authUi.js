import { formatRetryAfter } from "./authRateLimit.js";

export const FORGOT_PASSWORD_GENERIC_MESSAGE =
  "If the email is registered, we have sent a password reset link.";
export const RESET_PASSWORD_INVALID_MESSAGE =
  "This reset link is invalid or has expired. Request a new password reset email.";
export const RESET_PASSWORD_SUCCESS_MESSAGE =
  "Password reset complete. Sign in with your new password.";
export const CHANGE_PASSWORD_SUCCESS_MESSAGE =
  "Password updated. Sign in again with your new password.";
export const PASSWORD_HIDDEN_HELPER = "Passwords stay hidden by default.";
export const PASSWORD_RULES_HELPER =
  "Use at least 8 characters, including at least 1 letter and 1 number.";
export const PASSWORD_CONFIRM_HELPER = "Enter the same password again to confirm it.";

const NOTICE_TONE_CLASSES = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
};

export function getAuthNoticeClasses(tone = "neutral") {
  return NOTICE_TONE_CLASSES[tone] || NOTICE_TONE_CLASSES.neutral;
}

export function buildRetryAfterMessage(seconds) {
  return `Too many attempts. Try again in ${formatRetryAfter(seconds)}.`;
}

export function buildResendCooldownMessage(seconds) {
  return `Please wait ${formatRetryAfter(seconds)} before requesting another code.`;
}

export function buildCooldownButtonLabel(seconds, fallbackLabel, prefix = "Try again in") {
  if (Number(seconds) > 0) {
    return `${prefix} ${Math.max(0, Math.ceil(Number(seconds) || 0))}s`;
  }
  return fallbackLabel;
}
