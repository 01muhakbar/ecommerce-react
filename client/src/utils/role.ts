export type Role = "super admin" | "admin" | "staff" | "user";

export function normalizeRole(v?: string): Role | undefined {
  const s = String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  if (s === "super admin" || s === "admin" || s === "staff" || s === "user") {
    return s as Role;
  }
  return undefined;
}

export function isSuperAdmin(role?: string | Role) {
  return normalizeRole(role as string) === "super admin";
}

export function isAdminRole(role?: string | Role) {
  const r = normalizeRole(role as string);
  return r === "admin" || r === "super admin";
}
