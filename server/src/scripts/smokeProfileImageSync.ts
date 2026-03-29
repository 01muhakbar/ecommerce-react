import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Store, User, sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-profile-${Date.now()}`;

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
};

class CookieClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) {
      headers.set("Cookie", this.cookie);
    }

    const response = await fetch(`${BASE_URL}${path}`, {
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

const createdUserIds: number[] = [];
const createdStoreIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-profile-image] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-profile-image] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(
    response.ok,
    true,
    `[mvf-profile-image] API not ready at ${BASE_URL}/api/health`
  );
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: login did not return success`);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function createFixtureUser(label: string, role = "customer") {
  const email = `${RUN_ID}-${label}@local.dev`;
  const password = DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: `MVF ${label}`,
    email,
    password: hashed,
    role,
    status: "active",
  } as any);
  const id = Number((user as any).id);
  createdUserIds.push(id);
  return { id, email, password };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = `${RUN_ID}-${label}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const store = await Store.create({
    ownerUserId,
    name: `MVF ${label}`,
    slug,
    status: "ACTIVE",
  } as any);
  const id = Number((store as any).id);
  createdStoreIds.push(id);
  return { id, slug };
}

async function cleanup() {
  if (createdStoreIds.length > 0) {
    await Store.destroy({ where: { id: createdStoreIds } as any });
  }
  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: createdUserIds } as any });
  }
}

function readAvatarValue(source: any) {
  return source?.avatarUrl ?? source?.avatar ?? null;
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();

  const adminClient = new CookieClient();
  await loginAdmin(adminClient);

  logStep("load original admin profile");
  const adminOriginalResponse = await adminClient.request("/api/admin/me");
  assertStatus(adminOriginalResponse, 200, "admin me");
  const adminProfile = adminOriginalResponse.body?.data;
  assert.ok(adminProfile?.name, "admin profile should exist");
  const originalAdminName = String(adminProfile?.name || "");
  const originalAdminPhone = adminProfile?.phone ?? null;
  const originalAdminAvatar = readAvatarValue(adminProfile);
  logPass("admin profile load");

  logStep("persist admin avatar");
  const adminAvatarPath = `/uploads/admin-${RUN_ID}.png`;
  const adminUpdateResponse = await adminClient.request("/api/admin/me", {
    method: "PUT",
    body: JSON.stringify({
      name: originalAdminName,
      phone: originalAdminPhone,
      avatarUrl: adminAvatarPath,
    }),
  });
  assertStatus(adminUpdateResponse, 200, "admin me update");
  assert.equal(readAvatarValue(adminUpdateResponse.body?.data), adminAvatarPath);
  const adminAuthResponse = await adminClient.request("/api/auth/me");
  assertStatus(adminAuthResponse, 200, "admin auth me");
  assert.equal(readAvatarValue(adminAuthResponse.body?.data?.user), adminAvatarPath);
  logPass("admin avatar persistence");

  logStep("restore admin avatar");
  const adminRestoreResponse = await adminClient.request("/api/admin/me", {
    method: "PUT",
    body: JSON.stringify({
      name: originalAdminName,
      phone: originalAdminPhone,
      avatarUrl: originalAdminAvatar,
    }),
  });
  assertStatus(adminRestoreResponse, 200, "admin me restore");
  logPass("admin avatar restore");

  logStep("persist client avatar via user profile");
  const clientFixture = await createFixtureUser("client");
  const clientUser = new CookieClient();
  await login(clientUser, clientFixture.email, clientFixture.password, "client login");

  const clientAvatarPath = `/uploads/products/client-${RUN_ID}.png`;
  const userMeBefore = await clientUser.request("/api/user/me");
  assertStatus(userMeBefore, 200, "user me before");
  assert.equal(readAvatarValue(userMeBefore.body?.data), null, "client avatar should default to null");

  const userMeUpdate = await clientUser.request("/api/user/me", {
    method: "PUT",
    body: JSON.stringify({
      name: "MVF client",
      avatarUrl: clientAvatarPath,
    }),
  });
  assertStatus(userMeUpdate, 200, "user me update");
  assert.equal(readAvatarValue(userMeUpdate.body?.data), clientAvatarPath);

  const clientAuthAfterUserMe = await clientUser.request("/api/auth/me");
  assertStatus(clientAuthAfterUserMe, 200, "client auth after user me update");
  assert.equal(readAvatarValue(clientAuthAfterUserMe.body?.data?.user), clientAvatarPath);
  logPass("client avatar persistence via user me");

  logStep("persist and clear client avatar via store profile");
  const storeProfileUpdate = await clientUser.request("/api/store/profile", {
    method: "PUT",
    body: JSON.stringify({
      name: "MVF client",
      avatarUrl: null,
    }),
  });
  assertStatus(storeProfileUpdate, 200, "store profile update");
  assert.equal(readAvatarValue(storeProfileUpdate.body?.data), null, "store profile should clear avatar");

  const clientAuthAfterClear = await clientUser.request("/api/auth/me");
  assertStatus(clientAuthAfterClear, 200, "client auth after clear");
  assert.equal(readAvatarValue(clientAuthAfterClear.body?.data?.user), null);
  logPass("client avatar clear fallback");

  logStep("persist and clear seller store logo");
  const sellerFixture = await createFixtureUser("seller");
  const sellerStore = await createFixtureStore(sellerFixture.id, "seller-store");
  const sellerClient = new CookieClient();
  await login(sellerClient, sellerFixture.email, sellerFixture.password, "seller login");

  const sellerLogoPath = `/uploads/products/seller-${RUN_ID}.png`;
  const sellerPatchResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/store-profile`,
    {
      method: "PATCH",
      body: JSON.stringify({
        logoUrl: sellerLogoPath,
      }),
    }
  );
  assertStatus(sellerPatchResponse, 200, "seller store profile update");
  assert.equal(sellerPatchResponse.body?.data?.logoUrl, sellerLogoPath);

  const sellerContextResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/context`
  );
  assertStatus(sellerContextResponse, 200, "seller context");
  assert.equal(sellerContextResponse.body?.data?.store?.logoUrl, sellerLogoPath);
  assert.equal(sellerContextResponse.body?.data?.store?.imageUrl, sellerLogoPath);

  const sellerClearResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/store-profile`,
    {
      method: "PATCH",
      body: JSON.stringify({
        logoUrl: null,
      }),
    }
  );
  assertStatus(sellerClearResponse, 200, "seller store profile clear");
  assert.equal(sellerClearResponse.body?.data?.logoUrl, null);
  logPass("seller logo sync and fallback");

  console.log("[mvf-profile-image] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-profile-image] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    await sequelize.close();
  });
