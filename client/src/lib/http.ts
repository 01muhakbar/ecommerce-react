// Always use Vite dev proxy for API in development to avoid port coupling
const API_BASE = "/api";

export async function http<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;
  const headers = isFormData
    ? { ...(init?.headers || {}) } // let browser set multipart boundary
    : { "Content-Type": "application/json", ...(init?.headers || {}) };

  const res = await fetch(API_BASE + url, {
    credentials: "include",
    headers,
    ...init,
  });
  if (!res.ok) throw new Error((await res.text()) || "HTTP error");
  const ct = res.headers.get("content-type");
  return ct && ct.includes("application/json")
    ? ((await res.json()) as T)
    : (undefined as T);
}

export async function post<T = unknown>(
  url: string,
  data?: unknown
): Promise<T> {
  return http<T>(url, {
    method: "POST",
    body: data ? JSON.stringify(data) : undefined,
  });
}

export async function put<T = unknown>(url: string, data: unknown): Promise<T> {
  return http<T>(url, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function patch<T = unknown>(
  url: string,
  data: unknown
): Promise<T> {
  return http<T>(url, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function del<T = unknown>(url: string): Promise<T> {
  return http<T>(url, { method: "DELETE" });
}

export default http;
