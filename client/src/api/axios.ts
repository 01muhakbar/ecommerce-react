// ✅ ensure credentials are always sent to the API
import axios from "axios";

export const api = axios.create({
  baseURL: "/api", // <— penting: lewat proxy
  withCredentials: true, // <— important for cookies
  headers: { "X-Requested-With": "XMLHttpRequest" },
});

// Optional: small response/error helpers for consistent logging
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err?.response?.status;
    const msg = err?.response?.data || err.message;
    // eslint-disable-next-line no-console
    console.error("[api error]", status, msg);
    return Promise.reject(err);
  }
);
