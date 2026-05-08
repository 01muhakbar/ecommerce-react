import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcrypt";
import app from "../app.js";
import { User, sequelize } from "../models/index.js";

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
  headers: Headers;
};

class CookieClient {
  private cookie = "";

  constructor(private readonly baseUrl: string) {}

  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) {
      headers.set("Cookie", this.cookie);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0] || this.cookie;
    }

    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return {
      status: response.status,
      ok: response.ok,
      body,
      text,
      headers: response.headers,
    };
  }
}

const RUN_ID = `storefront-admin-block-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[storefront-admin-login-block-smoke] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[storefront-admin-login-block-smoke] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function createFixtureUser(
  role: "customer" | "admin" | "staff" | "super_admin",
  password: string
) {
  const email = `${RUN_ID}-${role}@example.test`;
  const user = await User.create({
    name: `Smoke ${role}`,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password, role };
}

async function verifyStorefrontLoginAccepted(
  baseUrl: string,
  fixture: Awaited<ReturnType<typeof createFixtureUser>>
) {
  const client = new CookieClient(baseUrl);
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
    }),
  });
  assertStatus(response, 200, `${fixture.role} storefront login`);
  assert.equal(
    String(response.body?.data?.user?.role || ""),
    fixture.role,
    `${fixture.role} storefront login role mismatch`
  );

  const me = await client.request("/api/auth/me");
  assertStatus(me, 200, `${fixture.role} auth me after storefront login`);
  assert.equal(
    String(me.body?.data?.user?.role || ""),
    fixture.role,
    `${fixture.role} me role mismatch`
  );
  logPass(`${fixture.role} accepted by storefront login`);
}

async function verifyAdminWorkspaceRoleBlocked(
  baseUrl: string,
  fixture: Awaited<ReturnType<typeof createFixtureUser>>
) {
  const client = new CookieClient(baseUrl);
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
    }),
  });
  assertStatus(response, 403, `${fixture.role} storefront login blocked`);
  assert.equal(
    String(response.body?.code || ""),
    "ADMIN_WORKSPACE_LOGIN_REQUIRED",
    `${fixture.role} storefront block code mismatch`
  );
  assert.equal(
    String(response.body?.message || ""),
    "This account uses Admin Workspace login. Sign in from /admin/login.",
    `${fixture.role} storefront block message mismatch`
  );

  const me = await client.request("/api/auth/me");
  assertStatus(me, 401, `${fixture.role} should not receive auth session after blocked storefront login`);
  logPass(`${fixture.role} rejected by storefront login`);
}

async function cleanupFixtures() {
  if (createdUserIds.length > 0) {
    await User.destroy({
      where: { id: [...new Set(createdUserIds)] } as any,
      force: true,
    }).catch(() => null);
  }
}

async function runScenario(baseUrl: string) {
  const customer = await createFixtureUser("customer", "CustomerPass123!");
  const admin = await createFixtureUser("admin", "AdminPass123!");
  const staff = await createFixtureUser("staff", "StaffPass123!");
  const superAdmin = await createFixtureUser("super_admin", "SuperPass123!");

  logStep("verify customer still passes storefront login");
  await verifyStorefrontLoginAccepted(baseUrl, customer);

  logStep("verify admin stays blocked from storefront login");
  await verifyAdminWorkspaceRoleBlocked(baseUrl, admin);

  logStep("verify staff stays blocked from storefront login");
  await verifyAdminWorkspaceRoleBlocked(baseUrl, staff);

  logStep("verify super admin stays blocked from storefront login");
  await verifyAdminWorkspaceRoleBlocked(baseUrl, superAdmin);
}

async function run() {
  await sequelize.authenticate();

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object", "smoke app failed to bind");
  const baseUrl = `http://127.0.0.1:${Number(address.port)}`;

  try {
    process.env.COOKIE_SECURE = "false";
    process.env.NODE_ENV = "development";
    await runScenario(baseUrl);
    console.log("[storefront-admin-login-block-smoke] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[storefront-admin-login-block-smoke] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[storefront-admin-login-block-smoke] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
