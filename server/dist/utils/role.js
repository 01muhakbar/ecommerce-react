// server/src/utils/role.ts
export const normalizeRoleServer = (s) => (s ?? "")
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-"); // <-- spasi ATAU underscore menjadi dash
export const isAdminLike = (s) => {
    const r = normalizeRoleServer(s);
    return r === "admin" || r === "super-admin";
};
