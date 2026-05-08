import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import {
  Product,
  Store,
  StoreMember,
  StorePaymentProfile,
  User,
  sequelize,
} from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf6-admin-payment-profiles-${Date.now()}`;

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
const createdPaymentProfileIds: number[] = [];
const createdProductIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-admin-store-payment-profiles] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-admin-store-payment-profiles] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(
    response.ok,
    true,
    `[mvf-admin-store-payment-profiles] API not ready at ${BASE_URL}/api/health`
  );
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `MVF ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = slugify(`${RUN_ID}-${label}`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-${label}`,
    slug,
    status: "ACTIVE",
    description: `Description ${label}`,
    email: `${slug}@local.dev`,
    phone: "081234567890",
    logoUrl: "https://example.com/logo.png",
    addressLine1: "Jl. Admin Payment No. 1",
    city: "Jakarta",
    province: "DKI Jakarta",
    country: "Indonesia",
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug };
}

async function createReadyPaymentProfile(storeId: number) {
  const now = new Date();
  const profile = await StorePaymentProfile.create({
    storeId,
    providerCode: "MANUAL_QRIS",
    paymentType: "QRIS_STATIC",
    version: 1,
    snapshotStatus: "ACTIVE",
    accountName: `MVF Account ${storeId}`,
    merchantName: `MVF Merchant ${storeId}`,
    merchantId: `MVF-${storeId}`,
    qrisImageUrl: `https://example.com/${RUN_ID}-${storeId}.png`,
    qrisPayload: `${RUN_ID}-${storeId}-payload`,
    instructionText: "MVF admin payment profile smoke payment instructions.",
    isActive: true,
    verificationStatus: "ACTIVE",
    verifiedAt: now,
    activatedAt: now,
  } as any);
  const id = Number(profile.getDataValue("id"));
  createdPaymentProfileIds.push(id);
  await Store.update(
    { activeStorePaymentProfileId: id } as any,
    { where: { id: storeId } as any }
  );
}

async function createFixtureProduct(ownerUserId: number, storeId: number, label: string) {
  const slug = slugify(`${RUN_ID}-${label}`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 65000,
    stock: 7,
    userId: ownerUserId,
    storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug };
}

async function cleanupFixtures() {
  if (createdProductIds.length > 0) {
    await Product.destroy({
      where: { id: { [Op.in]: createdProductIds } } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdStoreIds.length > 0) {
    await Store.update(
      { activeStorePaymentProfileId: null } as any,
      { where: { id: { [Op.in]: createdStoreIds } } as any }
    ).catch(() => null);
  }

  if (createdPaymentProfileIds.length > 0) {
    await StorePaymentProfile.destroy({
      where: { id: { [Op.in]: createdPaymentProfileIds } } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdStoreIds.length > 0 || createdUserIds.length > 0) {
    await StoreMember.destroy({
      where: {
        ...(createdStoreIds.length > 0 ? { storeId: createdStoreIds } : {}),
        ...(createdUserIds.length > 0 ? { userId: createdUserIds } : {}),
      } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdStoreIds.length > 0) {
    await Store.destroy({
      where: { id: { [Op.in]: createdStoreIds } } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdUserIds.length > 0) {
    await User.destroy({
      where: { id: { [Op.in]: createdUserIds } } as any,
      force: true,
    }).catch(() => null);
  }
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();

  logStep("creating admin payment profile fixtures");
  const readyOwner = await createFixtureUser("ready-owner");
  const gatedOwner = await createFixtureUser("gated-owner");
  const readyStore = await createFixtureStore(readyOwner.id, "ready-store");
  const gatedStore = await createFixtureStore(gatedOwner.id, "gated-store");
  await createReadyPaymentProfile(readyStore.id);
  await createFixtureProduct(readyOwner.id, readyStore.id, "ready-product");
  await createFixtureProduct(gatedOwner.id, gatedStore.id, "gated-product");

  logStep("loading admin payment profiles page data");
  const adminClient = new CookieClient();
  await loginAdmin(adminClient);
  const response = await adminClient.request("/api/admin/stores/payment-profiles");
  assertStatus(response, 200, "admin payment profiles list");

  const items = Array.isArray(response.body?.data) ? response.body.data : [];
  const readyEntry =
    items.find((entry: any) => Number(entry?.store?.id || 0) === readyStore.id) || null;
  const gatedEntry =
    items.find((entry: any) => Number(entry?.store?.id || 0) === gatedStore.id) || null;

  assert.ok(readyEntry, "ready store entry should be present");
  assert.ok(gatedEntry, "gated store entry should be present");
  assert.equal(
    Boolean(readyEntry?.paymentProfile?.readiness?.isReady),
    true,
    "ready store payment profile should be ready"
  );
  const readyChecklist = Array.isArray(readyEntry?.workspaceReadiness?.checklist)
    ? readyEntry.workspaceReadiness.checklist
    : [];
  const gatedChecklist = Array.isArray(gatedEntry?.workspaceReadiness?.checklist)
    ? gatedEntry.workspaceReadiness.checklist
    : [];
  const readyPaymentChecklist =
    readyChecklist.find((item: any) => String(item?.key || "") === "payment_profile") || null;
  const gatedPaymentChecklist =
    gatedChecklist.find((item: any) => String(item?.key || "") === "payment_profile") || null;
  assert.equal(
    Boolean(readyPaymentChecklist?.isComplete),
    true,
    "ready store payment profile checklist should be complete"
  );
  assert.equal(
    typeof readyEntry?.workspaceReadiness?.summary?.code,
    "string",
    "ready store workspace readiness summary should exist"
  );
  assert.equal(
    Array.isArray(gatedChecklist),
    true,
    "gated store workspace checklist should exist"
  );
  assert.equal(
    Boolean(gatedPaymentChecklist),
    true,
    "payment profile checklist item should be present"
  );
  assert.equal(
    Boolean(gatedPaymentChecklist?.isComplete),
    false,
    "gated store payment profile checklist should stay incomplete"
  );
  logPass("admin payment profiles list and readiness load");

  console.log("[mvf-admin-store-payment-profiles] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-admin-store-payment-profiles] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupFixtures();
    } catch (cleanupError) {
      console.error("[mvf-admin-store-payment-profiles] cleanup failed", cleanupError);
      process.exitCode = 1;
    }
    try {
      await sequelize.close();
    } catch {
      // ignore close failures in smoke cleanup
    }
  });
