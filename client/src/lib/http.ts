export async function http<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(import.meta.env.VITE_API_BASE + url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
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
