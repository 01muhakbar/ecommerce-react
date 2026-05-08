import { useAuth } from "./useAuth.js";

const toRole = (auth) => String(auth?.role ?? auth?.user?.role ?? "").toLowerCase();
const isAdminRoleValue = (role) =>
  ["admin", "super_admin", "superadmin", "staff"].includes(String(role || "").toLowerCase());

export function useAdminAuth() {
  const auth = useAuth() || {};
  const role = toRole(auth);
  const isAdminRole = isAdminRoleValue(role);

  return {
    user: auth.user ?? null,
    role: auth.role ?? null,
    isLoading: Boolean(auth.isLoading),
    isAuthenticated: Boolean(auth.isAuthenticated),
    isAdminRole,
    login: auth.login,
    logout: auth.logout,
    refreshSession: auth.refreshSession,
  };
}

export function useSellerAuth() {
  const auth = useAuth() || {};
  const role = toRole(auth);
  const isAdminRole = isAdminRoleValue(role);
  const isAuthenticated = Boolean(auth.isAuthenticated);
  const isSellerSession = isAuthenticated && !isAdminRole;

  return {
    user: auth.user ?? null,
    role: auth.role ?? null,
    isLoading: Boolean(auth.isLoading),
    isAuthenticated,
    isAdminSession: isAuthenticated && isAdminRole,
    isSellerSession,
    isStoreSession: isSellerSession,
    refreshSession: auth.refreshSession,
    logout: auth.logout,
  };
}

export function useAccountAuth() {
  const auth = useAuth() || {};
  const role = toRole(auth);
  const isAdminRole = isAdminRoleValue(role);

  return {
    user: auth.user ?? null,
    role: auth.role ?? null,
    isLoading: Boolean(auth.isLoading),
    isAuthenticated: Boolean(auth.isAuthenticated),
    isAccountSession: Boolean(auth.isAuthenticated) && !isAdminRole,
    login: auth.login,
    logout: auth.logout,
    refreshSession: auth.refreshSession,
  };
}
