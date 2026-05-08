import { readPendingAuthNotice } from "./authSessionNotice.js";

export const ACCOUNT_LOGIN_REQUIRED_NOTICE = "Sign in to access your account.";
export const CHECKOUT_LOGIN_REQUIRED_NOTICE = "Sign in to continue checkout.";
export const CART_LOGIN_REQUIRED_NOTICE = "Sign in to continue with your cart.";
export const NOTIFICATIONS_LOGIN_REQUIRED_NOTICE =
  "Sign in to view your notifications.";
export const ORDERS_LOGIN_REQUIRED_NOTICE = "Sign in to view your orders.";
export const REVIEWS_LOGIN_REQUIRED_NOTICE = "Sign in to access your reviews.";

const normalizeFrom = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || "";
  }
  if (
    value &&
    typeof value === "object" &&
    "pathname" in value &&
    typeof value.pathname === "string"
  ) {
    const location = value as {
      pathname?: string;
      search?: string;
      hash?: string;
    };
    return `${location.pathname || ""}${location.search || ""}${location.hash || ""}`.trim();
  }
  return "";
};

export const buildLoginRedirectState = ({
  from,
  authNotice,
  postLoginState,
}: {
  from?: unknown;
  authNotice?: string;
  postLoginState?: Record<string, unknown>;
} = {}) => {
  const state: {
    from?: string;
    authNotice?: string;
    postLoginState?: Record<string, unknown>;
  } = {};
  const normalizedFrom = normalizeFrom(from);
  if (normalizedFrom) {
    state.from = normalizedFrom;
  }
  const notice = String(readPendingAuthNotice() || authNotice || "").trim();
  if (notice) {
    state.authNotice = notice;
  }
  if (postLoginState && typeof postLoginState === "object") {
    state.postLoginState = postLoginState;
  }
  return state;
};
