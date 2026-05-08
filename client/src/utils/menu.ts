import { normalizeRole, type Role } from "./role";

export type RoleName = Role;
export type MenuItem = {
  key: string;
  to: string;
  label: string;
  icon?: React.ReactNode;
  children?: { to: string; label: string }[];
  /** Minimal role yang wajib dipenuhi terlepas dari allowlist fitur (routes) */
  minRole?: RoleName;
};

const ROLE_RANK: Record<RoleName, number> = {
  "super admin": 3,
  admin: 2,
  staff: 1,
  user: 0,
};

/** True jika role user memenuhi minimal role */
function hasMinRole(userRole: string | undefined, minRole?: RoleName): boolean {
  if (!minRole) return true;
  const u = normalizeRole(userRole);
  if (!u) return false;
  return ROLE_RANK[u] >= ROLE_RANK[minRole];
}

/** Filter menu berdasarkan minRole DAN allowlist fitur (me.routes) */
export function filterMenu(
  items: MenuItem[],
  me?: { role?: string; routes?: string[] }
) {
  const userRole = me?.role;
  const routes = me?.routes ?? [];
  const u = normalizeRole(userRole);

  return items.filter((it) => {
    if (!hasMinRole(userRole, it.minRole)) return false;
    if (u === "super admin") return true; // ⬅️ bypass
    return routes.includes(it.key); // selain super admin, butuh allowlist
  });
}
