import axios, { AxiosHeaders } from "axios";
import { triggerUnauthorized } from "../auth/authEvents.ts";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.request.use((config) => {
  let token = null;
  try {
    token = localStorage.getItem("authToken");
  } catch (_) {
    token = null;
  }

  const headers = AxiosHeaders.from(config.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.delete("Authorization");
  }
  config.headers = headers;

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const url = err?.config?.url || "";
    const isAuthMe = typeof url === "string" && url.includes("/auth/me");
    const isAuthFormEndpoint =
      typeof url === "string" &&
      [
        "/auth/login",
        "/auth/admin/login",
        "/auth/register",
        "/auth/register/resend-otp",
        "/auth/register/verify-otp",
        "/auth/forgot-password",
        "/auth/reset-password",
        "/auth/admin/register",
        "/auth/admin/register/resend-verification",
        "/auth/admin/verify-email",
        "/auth/admin/forgot-password",
        "/auth/admin/reset-password",
        "/auth/logout",
        "/auth/admin/logout",
      ].some((path) => url.includes(path));
    const msg = err?.response?.data || err.message;
    if (status === 401 && !isAuthMe && !isAuthFormEndpoint) {
      triggerUnauthorized({
        status,
        code: err?.response?.data?.code,
        message: err?.response?.data?.message,
      });
    }
    // eslint-disable-next-line no-console
    if (!status || status >= 500) {
      console.error("[api error]", status, msg);
    }
    return Promise.reject(err);
  }
);
