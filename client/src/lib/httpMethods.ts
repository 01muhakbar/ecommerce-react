// DEPRECATED: Do not use. Use client/src/api/axios.ts + services instead.
import { http } from "./http";

export const post = async <T = unknown>(
  url: string,
  data?: unknown
): Promise<T> =>
  http<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });

export const put = async <T = unknown>(
  url: string,
  data: unknown
): Promise<T> => http<T>(url, { method: "PUT", body: JSON.stringify(data) });

export const patch = async <T = unknown>(
  url: string,
  data: unknown
): Promise<T> => http<T>(url, { method: "PATCH", body: JSON.stringify(data) });

export const del = async <T = unknown>(url: string): Promise<T> =>
  http<T>(url, { method: "DELETE" });

export { http };
export default http;
