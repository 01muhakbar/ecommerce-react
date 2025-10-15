// server/src/utils/role.ts
export const normalizeRoleServer = (s?: string) =>
  (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-"); // <-- spasi ATAU underscore menjadi dash

export const isAdminLike = (s?: string) => {
  const r = normalizeRoleServer(s);
  return r === "admin" || r === "super-admin";
};