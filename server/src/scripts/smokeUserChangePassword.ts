import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { once } from "node:events";
import app from "../app.js";
import { User, sequelize } from "../models/index.js";

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
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
    };
  }
}

const RUN_ID = `user-change-password-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];

const START_PASSWORD = "StartPass123";
const NEXT_PASSWORD = "NextPass456";

const logStep = (label: string) => {
  console.log(`[user-change-password-smoke] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[user-change-password-smoke] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function createFixtureUser() {
  const email = `${RUN_ID}@example.test`;
  const user = await User.create({
    name: "User Change Password Smoke",
    email,
    password: await bcrypt.hash(START_PASSWORD, 10),
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email };
}

async function runScenario(baseUrl: string) {
  const fixture = await createFixtureUser();
  const client = new CookieClient(baseUrl);
  const freshClient = new CookieClient(baseUrl);

  logStep("login with the starting password");
  const loginResponse = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: START_PASSWORD,
    }),
  });
  assertStatus(loginResponse, 200, "initial login");
  logPass("initial login succeeds");

  logStep("reject incorrect current password");
  const wrongCurrentResponse = await client.request("/api/user/change-password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword: "WrongPass999",
      newPassword: NEXT_PASSWORD,
    }),
  });
  assertStatus(wrongCurrentResponse, 422, "incorrect current password");
  assert.equal(
    String(wrongCurrentResponse.body?.message || ""),
    "Current password is incorrect",
    "incorrect current password message mismatch"
  );
  logPass("incorrect current password is rejected");

  logStep("change password with valid current password");
  const changeResponse = await client.request("/api/user/change-password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword: START_PASSWORD,
      newPassword: NEXT_PASSWORD,
    }),
  });
  assertStatus(changeResponse, 200, "change password");
  assert.equal(
    String(changeResponse.body?.message || ""),
    "Password updated",
    "change password success message mismatch"
  );

  const updatedUser = await User.findByPk(fixture.id);
  assert.ok(updatedUser, "fixture user missing after password update");
  const passwordMatches = await bcrypt.compare(
    NEXT_PASSWORD,
    String(updatedUser?.getDataValue("password") || "")
  );
  assert.equal(passwordMatches, true, "database password hash did not update");
  logPass("database password hash updated");

  logStep("invalidate the old authenticated session after password change");
  const oldSessionResponse = await client.request("/api/auth/me");
  assertStatus(oldSessionResponse, 401, "old session after password change");
  logPass("old session invalidated");

  logStep("old password fails and new password succeeds");
  const oldPasswordLogin = await freshClient.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: START_PASSWORD,
    }),
  });
  assertStatus(oldPasswordLogin, 401, "old password login after change");

  const newPasswordLogin = await freshClient.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: NEXT_PASSWORD,
    }),
  });
  assertStatus(newPasswordLogin, 200, "new password login after change");

  const newSessionMe = await freshClient.request("/api/auth/me");
  assertStatus(newSessionMe, 200, "auth me after new password login");
  logPass("new password login succeeds");
}

async function cleanupFixtures() {
  if (createdUserIds.length > 0) {
    await User.destroy({
      where: { id: [...new Set(createdUserIds)] } as any,
      force: true,
    }).catch(() => null);
  }
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
    process.env.CLIENT_URL = baseUrl;
    process.env.NODE_ENV = "development";
    await runScenario(baseUrl);
    console.log("[user-change-password-smoke] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[user-change-password-smoke] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[user-change-password-smoke] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
