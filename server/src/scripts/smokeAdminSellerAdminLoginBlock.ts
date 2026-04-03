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

const RUN_ID = `auth-admin-block-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[admin-seller-admin-login-block-smoke] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[admin-seller-admin-login-block-smoke] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

const withEnv = async (
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>
) => {
  const originalEntries = Object.entries(overrides).map(([key]) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of originalEntries) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

async function createFixtureUser(role: "seller" | "admin" | "super_admin", password: string) {
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

async function verifyAdminLoginAccepted(baseUrl: string, fixture: Awaited<ReturnType<typeof createFixtureUser>>) {
  const client = new CookieClient(baseUrl);
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
    }),
  });
  assertStatus(response, 200, `${fixture.role} admin login`);
  assert.equal(String(response.body?.user?.role || ""), fixture.role, `${fixture.role} role mismatch`);

  const me = await client.request("/api/auth/me");
  assertStatus(me, 200, `${fixture.role} auth me after admin login`);
  assert.equal(String(me.body?.data?.user?.role || ""), fixture.role, `${fixture.role} me role mismatch`);
  logPass(`${fixture.role} accepted by admin login`);
}

async function verifySellerBlocked(baseUrl: string, fixture: Awaited<ReturnType<typeof createFixtureUser>>) {
  const client = new CookieClient(baseUrl);
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.password,
    }),
  });
  assertStatus(response, 403, "seller admin login blocked");
  assert.equal(
    String(response.body?.message || ""),
    "This account does not have admin workspace access.",
    "seller block message mismatch"
  );

  const me = await client.request("/api/auth/me");
  assertStatus(me, 401, "seller should not receive auth session after blocked admin login");
  logPass("seller rejected by admin login");
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
  const admin = await createFixtureUser("admin", "AdminPass123!");
  const superAdmin = await createFixtureUser("super_admin", "SuperPass123!");

  logStep("verify seller stays blocked from /admin/login");
  await verifySellerBlocked(baseUrl, seller);

  logStep("verify admin still passes /admin/login");
  await verifyAdminLoginAccepted(baseUrl, admin);

  logStep("verify super admin still passes /admin/login");
  await verifyAdminLoginAccepted(baseUrl, superAdmin);
}

async function run() {
  await sequelize.authenticate();

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object", "smoke app failed to bind");
  const baseUrl = `http://127.0.0.1:${Number(address.port)}`;

  try {
    await withEnv(
      {
        COOKIE_SECURE: "false",
        NODE_ENV: "development",
      },
      async () => {
        await runScenario(baseUrl);
      }
    );

    console.log("[admin-seller-admin-login-block-smoke] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[admin-seller-admin-login-block-smoke] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[admin-seller-admin-login-block-smoke] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
