export const ROLES = {
  STAFF: "staff",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
};

const ROLE_RANK = {
  [ROLES.STAFF]: 1,
  [ROLES.ADMIN]: 2,
  [ROLES.SUPER_ADMIN]: 3,
};

const getRole = (user) => {
  const raw = String(user?.role || user || "").toLowerCase();
  if (!raw) return null;
  if (raw === "staf") return ROLES.STAFF;
  if (raw === "superadmin") return ROLES.SUPER_ADMIN;
  if (raw === "super admin") return ROLES.SUPER_ADMIN;
  return raw;
};

export const canMinRole = (user, minRole) => {
  const role = getRole(user);
  const rank = role ? ROLE_RANK[role] || 0 : 0;
  return rank >= (ROLE_RANK[minRole] || 0);
};

export const can = (user, perm) => {
  switch (perm) {
    case "DASHBOARD_VIEW":
    case "ORDERS_VIEW":
    case "ORDERS_UPDATE_STATUS":
    case "PRODUCTS_VIEW":
    case "CUSTOMERS_VIEW":
      return canMinRole(user, ROLES.STAFF);
    case "PRODUCTS_CREATE":
    case "PRODUCTS_UPDATE":
    case "PRODUCTS_DELETE":
    case "CATEGORIES_CRUD":
    case "COUPONS_CRUD":
    case "ATTRIBUTES_CRUD":
    case "CUSTOMERS_UPDATE":
      return canMinRole(user, ROLES.ADMIN);
    case "STAFF_MANAGE":
    case "SETTINGS_MANAGE":
      return canMinRole(user, ROLES.SUPER_ADMIN);
    default:
      return false;
  }
};
