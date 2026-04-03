import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { User } from "../models/index.js";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function normalizeRole(input: unknown) {
  const raw = String(input ?? "").toLowerCase().trim();
  if (!raw) return null;
  const snake = raw.replace(/[^a-z0-9]+/g, "_");
  if (
    ["super_admin", "super-admin", "super admin", "superadmin"].includes(raw) ||
    snake === "super_admin"
  ) {
    return "super_admin";
  }
  if (["admin", "administrator"].includes(raw) || snake === "admin") {
    return "admin";
  }
  if (["staf", "staff"].includes(raw) || snake === "staf" || snake === "staff") {
    return "staff";
  }
  return snake;
}

function normalizeUserId(payload: any) {
  const candidate = payload?.id ?? payload?.userId ?? payload?.sub;
  const normalized = Number(candidate);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

export function buildAuthPasswordVersion(passwordHash: unknown) {
  return crypto
    .createHash("sha256")
    .update(`${JWT_SECRET}:${String(passwordHash || "")}`)
    .digest("hex")
    .slice(0, 24);
}

async function loadUserForSession(userId: number) {
  return User.findByPk(userId, {
    attributes: ["id", "email", "name", "role", "avatarUrl", "phoneNumber", "status", "password"],
  });
}

function resolveUserUpdatedAtMs(user: any) {
  const value =
    user?.get?.("updated_at") ??
    user?.get?.("updatedAt") ??
    user?.updated_at ??
    user?.updatedAt ??
    null;
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

export async function buildAuthSessionClaims(user: any) {
  const userId = Number(user?.id ?? user?.get?.("id") ?? 0);
  if (!Number.isFinite(userId) || userId <= 0) {
    throw new Error("Cannot issue auth session for unknown user.");
  }

  let passwordHash = String(user?.password ?? user?.get?.("password") ?? "");
  let sessionUser = user;

  if (!passwordHash) {
    sessionUser = await loadUserForSession(userId);
    if (!sessionUser) {
      throw new Error("Cannot issue auth session for missing user.");
    }
    passwordHash = String(sessionUser.get?.("password") ?? sessionUser.password ?? "");
  }

  return {
    sub: String(userId),
    id: userId,
    email: String(sessionUser?.email ?? sessionUser?.get?.("email") ?? user?.email ?? ""),
    role: String(sessionUser?.role ?? sessionUser?.get?.("role") ?? user?.role ?? ""),
    name: String(sessionUser?.name ?? sessionUser?.get?.("name") ?? user?.name ?? ""),
    pwdv: buildAuthPasswordVersion(passwordHash),
  };
}

export async function resolveAuthenticatedUserFromToken(token: string) {
  const payload = jwt.verify(token, JWT_SECRET) as any;
  const userId = normalizeUserId(payload);
  if (!userId) return null;

  const user = await loadUserForSession(userId);
  if (!user) return null;

  const tokenPasswordVersion = String(payload?.pwdv || "").trim();
  const currentPasswordVersion = buildAuthPasswordVersion(user.get?.("password") ?? user.password);
  if (tokenPasswordVersion) {
    if (tokenPasswordVersion !== currentPasswordVersion) {
      return null;
    }
  } else {
    const issuedAtMs = Number(payload?.iat || 0) * 1000;
    const updatedAtMs = resolveUserUpdatedAtMs(user);
    if (!issuedAtMs || !updatedAtMs || issuedAtMs + 1000 < updatedAtMs) {
      return null;
    }
  }

  return {
    payload,
    user,
    authUser: {
      id: Number(user.get?.("id") ?? user.id),
      email: String(user.get?.("email") ?? user.email ?? ""),
      name: String(user.get?.("name") ?? user.name ?? ""),
      role: normalizeRole(user.get?.("role") ?? user.role),
      status: user.get?.("status") ?? user.status ?? null,
    },
  };
}
