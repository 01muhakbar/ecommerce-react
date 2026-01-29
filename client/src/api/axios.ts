import axios from "axios";
import { triggerUnauthorized } from "../auth/authEvents.ts";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const msg = err?.response?.data || err.message;
    if (status === 401) {
      triggerUnauthorized();
    }
    // eslint-disable-next-line no-console
    if (!status || status >= 500) {
      console.error("[api error]", status, msg);
    }
    return Promise.reject(err);
  }
);
