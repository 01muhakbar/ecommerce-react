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
  private readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  private buildCookieHeader() {
    return [...this.cookies.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  private storeSetCookie(headerValue: string | null) {
    if (!headerValue) return;
    const firstPair = String(headerValue).split(";")[0] || "";
    const separatorIndex = firstPair.indexOf("=");
    if (separatorIndex <= 0) return;
    const name = firstPair.slice(0, separatorIndex).trim();
    const value = firstPair.slice(separatorIndex + 1).trim();
    if (!name) return;
    if (!value) {
      this.cookies.delete(name);
      return;
    }
    this.cookies.set(name, value);
  }

  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const cookieHeader = this.buildCookieHeader();
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
    });

    this.storeSetCookie(response.headers.get("set-cookie"));

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

const RUN_ID = `parallel-auth-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[parallel-admin-store-session-smoke] ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function createFixtureUser(role: "seller" | "super_admin", password: string) {
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

async function verifyStorefrontProtected(client: CookieClient, expectedStatus: number, label: string) {
  const response = await client.request("/api/user/store-applications/current");
  assertStatus(response, expectedStatus, label);
}

async function verifyAdminMe(
  client: CookieClient,
  expectedStatus: number,
  expectedRole: string | null,
  label: string
) {
  const response = await client.request("/api/auth/admin/me");
  assertStatus(response, expectedStatus, label);
  if (expectedStatus === 200) {
    assert.equal(
      String(response.body?.data?.user?.role || ""),
      String(expectedRole || ""),
      `${label}: admin role mismatch`
    );
  }
}

async function verifyStorefrontMe(
  client: CookieClient,
  expectedStatus: number,
  expectedRole: string | null,
  label: string
) {
  const response = await client.request("/api/auth/me");
  assertStatus(response, expectedStatus, label);
  if (expectedStatus === 200) {
    assert.equal(
      String(response.body?.data?.user?.role || ""),
      String(expectedRole || ""),
      `${label}: storefront role mismatch`
    );
  }
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
  const seller = await createFixtureUser("seller", "SellerPass123!");
  const superAdmin = await createFixtureUser("super_admin", "SuperPass123!");
  const client = new CookieClient(baseUrl);

  logStep("login storefront seller");
  const storefrontLogin = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: seller.email,
      password: seller.password,
    }),
  });
  assertStatus(storefrontLogin, 200, "storefront login");
  await verifyStorefrontMe(client, 200, "seller", "storefront me after storefront login");
  await verifyAdminMe(client, 401, null, "admin me before admin login");
  await verifyStorefrontProtected(client, 200, "storefront protected endpoint after storefront login");

  logStep("login admin without destroying storefront session");
  const adminLogin = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: superAdmin.email,
      password: superAdmin.password,
    }),
  });
  assertStatus(adminLogin, 200, "admin login");
  await verifyStorefrontMe(client, 200, "seller", "storefront me should stay seller after admin login");
  await verifyAdminMe(client, 200, "super_admin", "admin me after admin login");
  await verifyStorefrontProtected(client, 200, "storefront protected endpoint should stay active after admin login");

  logStep("admin logout must keep storefront session alive");
  const adminLogout = await client.request("/api/auth/admin/logout", { method: "POST" });
  assertStatus(adminLogout, 204, "admin logout");
  await verifyAdminMe(client, 401, null, "admin me after admin logout");
  await verifyStorefrontMe(client, 200, "seller", "storefront me after admin logout");
  await verifyStorefrontProtected(client, 200, "storefront protected endpoint after admin logout");

  logStep("re-login admin then logout storefront only");
  const adminRelogin = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: superAdmin.email,
      password: superAdmin.password,
    }),
  });
  assertStatus(adminRelogin, 200, "admin relogin");
  const storefrontLogout = await client.request("/api/auth/logout", { method: "POST" });
  assertStatus(storefrontLogout, 200, "storefront logout");
  await verifyStorefrontProtected(client, 401, "storefront protected endpoint after storefront logout");
  await verifyAdminMe(client, 200, "super_admin", "admin me after storefront logout");
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
    console.log("[parallel-admin-store-session-smoke] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[parallel-admin-store-session-smoke] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[parallel-admin-store-session-smoke] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
