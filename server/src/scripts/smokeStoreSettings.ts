import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op, QueryTypes } from "sequelize";
import {
  Order,
  OrderItem,
  Product,
  Store,
  StoreMember,
  StorePaymentProfile,
  User,
  sequelize,
} from "../models/index.js";
import { ensureSettingsTable } from "../services/storeSettings.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf5-store-settings-${Date.now()}`;

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
const createdOrderIds: number[] = [];

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const logStep = (label: string) => {
  console.log(`[mvf-store-settings] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-store-settings] PASS ${label}`);
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
    `[mvf-store-settings] API not ready at ${BASE_URL}/api/health`
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

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const password = DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: `MVF ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password };
}

async function createFixtureStore(ownerUserId: number) {
  const slug = slugify(`${RUN_ID}-store`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-store`,
    slug,
    status: "ACTIVE",
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
    instructionText: "MVF store settings smoke payment instructions.",
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

async function createFixtureProduct(ownerUserId: number, storeId: number) {
  const slug = slugify(`${RUN_ID}-product`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 90000,
    stock: 10,
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

async function backupStoreSettingsValue() {
  await ensureSettingsTable();
  const rows = await sequelize.query<{ value: string }>(
    "SELECT `value` FROM settings WHERE `key` = 'storeSettings' LIMIT 1",
    { type: QueryTypes.SELECT }
  );
  return rows[0]?.value || null;
}

async function restoreStoreSettingsValue(value: string | null) {
  await ensureSettingsTable();
  if (!value) {
    await sequelize.query("DELETE FROM settings WHERE `key` = 'storeSettings'");
    return;
  }

  await sequelize.query(
    `
      INSERT INTO settings (\`key\`, \`value\`, createdAt, updatedAt)
      VALUES ('storeSettings', :value, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`value\` = VALUES(\`value\`),
        updatedAt = VALUES(updatedAt)
    `,
    {
      replacements: { value },
    }
  );
}

async function cleanupFixtures() {
  if (createdOrderIds.length > 0) {
    await OrderItem.destroy({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      force: true,
    }).catch(() => null);
    await Order.destroy({
      where: { id: { [Op.in]: createdOrderIds } } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdProductIds.length > 0) {
    await Product.destroy({
      where: { id: { [Op.in]: createdProductIds } } as any,
      force: true,
    }).catch(() => null);
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
  const settingsBackup = await backupStoreSettingsValue();

  try {
    logStep("creating checkout fixtures");
    const sellerUser = await createFixtureUser("seller-owner");
    const customerUser = await createFixtureUser("customer");
    const store = await createFixtureStore(sellerUser.id);
    await createReadyPaymentProfile(store.id);
    const product = await createFixtureProduct(sellerUser.id, store.id);

    logStep("authenticating admin and customer");
    const adminClient = new CookieClient();
    const customerClient = new CookieClient();
    await loginAdmin(adminClient);
    await login(customerClient, customerUser.email, customerUser.password, "customer login");

    logStep("persist settings with COD disabled and mixed config states");
    const disabledPayload = {
      storeSettings: {
        payments: {
          cashOnDeliveryEnabled: false,
          stripeEnabled: true,
          stripeKey: "not-a-stripe-key",
          stripeSecret: "not-a-stripe-secret",
          stripeWebhookSecret: "not-a-stripe-webhook-secret",
          razorPayEnabled: true,
          razorPayKeyId: "",
          razorPayKeySecret: "",
        },
        socialLogin: {
          googleEnabled: true,
          googleClientId: "google-client-id",
          googleSecretKey: "google-secret-value",
          githubEnabled: false,
          githubId: "",
          githubSecret: "",
          facebookEnabled: false,
          facebookId: "",
          facebookSecret: "",
        },
        analytics: {
          googleAnalyticsEnabled: true,
          googleAnalyticKey: "G-TEST1234",
        },
        chat: {
          tawkEnabled: true,
          tawkPropertyId: "abc123def456",
          tawkWidgetId: "xyz789abc123",
        },
      },
    };
    const updateDisabled = await adminClient.request("/api/admin/store/settings", {
      method: "PUT",
      body: JSON.stringify(disabledPayload),
    });
    assertStatus(updateDisabled, 200, "admin update disabled");
    assert.equal(
      String(updateDisabled.body?.data?.diagnostics?.payments?.stripe?.status?.code || ""),
      "INVALID",
      "admin diagnostics: stripe should stay invalid"
    );
    assert.equal(
      String(updateDisabled.body?.data?.diagnostics?.payments?.stripeWebhook?.status?.code || ""),
      "INVALID",
      "admin diagnostics: stripe webhook should stay invalid"
    );
    assert.equal(
      Boolean(updateDisabled.body?.data?.diagnostics?.socialLogin?.google?.secretConfigured),
      true,
      "admin diagnostics: google secret should be marked configured"
    );
    assert.equal(
      String(updateDisabled.body?.data?.storeSettings?.payments?.stripeSecret || ""),
      "",
      "admin response should not echo stripe secret"
    );
    assert.equal(
      String(updateDisabled.body?.data?.storeSettings?.payments?.stripeWebhookSecret || ""),
      "",
      "admin response should not echo stripe webhook secret"
    );
    logPass("admin settings masking and diagnostics");

    logStep("verify public-safe settings payload");
    const publicDisabled = await new CookieClient().request("/api/store/settings");
    assertStatus(publicDisabled, 200, "public settings disabled");
    const publicPayments = publicDisabled.body?.data?.storeSettings?.payments;
    const publicSocial = publicDisabled.body?.data?.storeSettings?.socialLogin;
    const publicAnalytics = publicDisabled.body?.data?.storeSettings?.analytics;
    const publicChat = publicDisabled.body?.data?.storeSettings?.chat;
    assert.equal(
      Boolean(publicPayments?.cashOnDeliveryEnabled),
      false,
      "public settings: COD should be disabled"
    );
    assert.equal(
      Array.isArray(publicPayments?.methods) ? publicPayments.methods.length : -1,
      0,
      "public settings: checkout methods should be empty when COD is disabled"
    );
    assert.equal(
      Boolean(publicPayments?.stripeEnabled),
      false,
      "public settings: stripe should stay unavailable"
    );
    assert.equal(
      typeof publicPayments?.stripeWebhookSecret,
      "undefined",
      "public settings should not expose stripe webhook secret"
    );
    assert.equal(
      Boolean(publicSocial?.googleEnabled),
      false,
      "public settings: google social login should stay unavailable"
    );
    assert.equal(
      Boolean(publicAnalytics?.googleAnalyticsEnabled),
      true,
      "public settings: analytics should be enabled"
    );
    assert.equal(
      String(publicAnalytics?.googleAnalyticKey || ""),
      "G-TEST1234",
      "public settings: analytics key mismatch"
    );
    assert.equal(
      Boolean(publicChat?.tawkEnabled),
      true,
      "public settings: tawk should be enabled"
    );
    assert.equal(
      typeof publicDisabled.body?.data?.storeSettings?.socialLogin?.googleSecretKey,
      "undefined",
      "public settings should not expose social secrets"
    );
    logPass("public-safe settings payload");

    logStep("verify checkout blocks COD when disabled");
    const blockedOrder = await customerClient.request("/api/store/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: {
          name: "MVF Customer",
          phone: "081234567890",
          address: "Jl. Mawar No. 1 Jakarta",
        },
        paymentMethod: "COD",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    assertStatus(blockedOrder, 409, "checkout blocked order");
    assert.equal(
      String(blockedOrder.body?.code || ""),
      "STORE_PAYMENT_METHOD_NOT_AVAILABLE",
      "checkout blocked order: wrong error code"
    );
    logPass("checkout blocks disabled COD");

    logStep("re-enable COD and verify checkout sync");
    const enabledPayload = {
      storeSettings: {
        payments: {
          cashOnDeliveryEnabled: true,
          stripeEnabled: true,
          stripeKey: "pk_test_example12345",
          stripeSecret: "",
          razorPayEnabled: true,
          razorPayKeyId: "rzp_test_example12345",
          razorPayKeySecret: "",
        },
      },
    };
    const updateEnabled = await adminClient.request("/api/admin/store/settings", {
      method: "PUT",
      body: JSON.stringify(enabledPayload),
    });
    assertStatus(updateEnabled, 200, "admin update enabled");
    const publicEnabled = await new CookieClient().request("/api/store/settings");
    assertStatus(publicEnabled, 200, "public settings enabled");
    const enabledMethods = Array.isArray(publicEnabled.body?.data?.storeSettings?.payments?.methods)
      ? publicEnabled.body.data.storeSettings.payments.methods
      : [];
    assert.equal(
      enabledMethods.some((method: any) => String(method?.code || "") === "COD"),
      true,
      "public settings: COD should be available after enable"
    );
    logPass("public checkout methods sync");

    logStep("verify checkout succeeds again");
    const allowedOrder = await customerClient.request("/api/store/orders", {
      method: "POST",
      body: JSON.stringify({
        customer: {
          name: "MVF Customer",
          phone: "081234567890",
          address: "Jl. Mawar No. 1 Jakarta",
        },
        paymentMethod: "COD",
        items: [{ productId: product.id, qty: 1 }],
      }),
    });
    assertStatus(allowedOrder, 201, "checkout allowed order");
    const orderId = Number(allowedOrder.body?.data?.id || 0);
    if (orderId > 0) {
      createdOrderIds.push(orderId);
    }
    assert.equal(
      String(allowedOrder.body?.data?.paymentMethod || ""),
      "COD",
      "checkout allowed order: payment method mismatch"
    );
    logPass("checkout succeeds with enabled COD");

    console.log("[mvf-store-settings] OK");
  } finally {
    await restoreStoreSettingsValue(settingsBackup);
  }
}

run()
  .catch((error) => {
    console.error("[mvf-store-settings] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupFixtures();
    } catch (cleanupError) {
      console.error("[mvf-store-settings] cleanup failed", cleanupError);
      process.exitCode = 1;
    }
    try {
      await sequelize.close();
    } catch {
      // ignore close failures in smoke cleanup
    }
  });
