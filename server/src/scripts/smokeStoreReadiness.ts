import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { Product, Store, StorePaymentProfile, User, sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf4-ready-${Date.now()}`;

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
};

type FixtureUser = {
  id: number;
  email: string;
  password: string;
};

type FixtureStore = {
  id: number;
  slug: string;
};

type FixtureProduct = {
  id: number;
  slug: string;
  storeId: number;
};

class PublicClient {
  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
    });
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

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const logStep = (label: string) => {
  console.log(`[mvf-store-readiness] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-store-readiness] PASS ${label}`);
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
    `[mvf-store-readiness] API not ready at ${BASE_URL}/api/health`
  );
}

async function createFixtureUser(label: string): Promise<FixtureUser> {
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

async function createFixtureStore(ownerUserId: number, label: string): Promise<FixtureStore> {
  const slug = slugify(`${RUN_ID}-${label}`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-${label}`,
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
    instructionText: "MVF readiness smoke payment instructions.",
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

async function createFixtureProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
}): Promise<FixtureProduct> {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 25000,
    stock: 15,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return {
    id,
    slug,
    storeId: input.storeId,
  };
}

const getOperationalReadiness = (body: any, label: string) => {
  const readiness = body?.data?.summary?.operationalReadiness;
  assert.ok(readiness && typeof readiness === "object", `${label}: operationalReadiness missing`);
  return readiness;
};

const getSellerInfo = (body: any, label: string) => {
  const sellerInfo = body?.data?.sellerInfo;
  assert.ok(sellerInfo && typeof sellerInfo === "object", `${label}: sellerInfo missing`);
  return sellerInfo;
};

async function fetchPublicIdentity(slug: string, label: string) {
  const client = new PublicClient();
  const response = await client.request(
    `/api/store/customization/identity/${encodeURIComponent(slug)}`
  );
  assertStatus(response, 200, label);
  return response.body;
}

async function fetchPublicProductDetail(
  productSlug: string,
  storeSlug: string,
  label: string
) {
  const client = new PublicClient();
  const response = await client.request(
    `/api/store/products/${encodeURIComponent(productSlug)}?storeSlug=${encodeURIComponent(storeSlug)}`
  );
  assertStatus(response, 200, label);
  return response.body;
}

async function verifyReadyScenario(store: FixtureStore, product: FixtureProduct) {
  logStep("verifying ready store public identity");
  const identityBody = await fetchPublicIdentity(store.slug, "ready public identity");
  const readiness = getOperationalReadiness(identityBody, "ready public identity");
  assert.equal(String(readiness.code || ""), "READY", "ready identity: code mismatch");
  assert.equal(Boolean(readiness.isReady), true, "ready identity: isReady should be true");
  logPass("ready public identity readiness");

  logStep("verifying ready store PDP seller info");
  const detailBody = await fetchPublicProductDetail(
    product.slug,
    store.slug,
    "ready product detail"
  );
  const sellerInfo = getSellerInfo(detailBody, "ready product detail");
  assert.equal(
    String(sellerInfo?.operationalReadiness?.code || ""),
    "READY",
    "ready seller info: readiness code mismatch"
  );
  assert.equal(
    Boolean(sellerInfo?.operationalReadiness?.isReady),
    true,
    "ready seller info: isReady should be true"
  );
  assert.equal(
    Boolean(sellerInfo?.canVisitStore),
    true,
    "ready seller info: canVisitStore should be true"
  );
  assert.equal(
    String(sellerInfo?.visitStoreHref || ""),
    `/store/${encodeURIComponent(store.slug)}`,
    "ready seller info: visitStoreHref mismatch"
  );
  logPass("ready seller info CTA");
}

async function verifyNotConfiguredScenario(store: FixtureStore, product: FixtureProduct) {
  logStep("verifying non-ready store public identity");
  const identityBody = await fetchPublicIdentity(store.slug, "non-ready public identity");
  const readiness = getOperationalReadiness(identityBody, "non-ready public identity");
  assert.equal(
    String(readiness.code || ""),
    "PAYMENT_NOT_CONFIGURED",
    "non-ready identity: code mismatch"
  );
  assert.equal(
    Boolean(readiness.isReady),
    false,
    "non-ready identity: isReady should be false"
  );
  logPass("non-ready public identity readiness");

  logStep("verifying non-ready store PDP seller info");
  const detailBody = await fetchPublicProductDetail(
    product.slug,
    store.slug,
    "non-ready product detail"
  );
  const sellerInfo = getSellerInfo(detailBody, "non-ready product detail");
  assert.equal(
    String(sellerInfo?.operationalReadiness?.code || ""),
    "PAYMENT_NOT_CONFIGURED",
    "non-ready seller info: readiness code mismatch"
  );
  assert.equal(
    String(sellerInfo?.status?.code || ""),
    "PAYMENT_NOT_CONFIGURED",
    "non-ready seller info: status badge should follow readiness gate"
  );
  assert.equal(
    Boolean(sellerInfo?.operationalReadiness?.isReady),
    false,
    "non-ready seller info: isReady should be false"
  );
  assert.equal(
    Boolean(sellerInfo?.canVisitStore),
    false,
    "non-ready seller info: canVisitStore should be false"
  );
  assert.equal(
    sellerInfo?.visitStoreHref ?? null,
    null,
    "non-ready seller info: visitStoreHref should be null"
  );
  logPass("non-ready seller info CTA gating");
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

  logStep("creating readiness fixtures");
  const readyOwner = await createFixtureUser("ready-owner");
  const gatedOwner = await createFixtureUser("gated-owner");

  const readyStore = await createFixtureStore(readyOwner.id, "ready-store");
  const gatedStore = await createFixtureStore(gatedOwner.id, "gated-store");
  await createReadyPaymentProfile(readyStore.id);

  const readyProduct = await createFixtureProduct({
    ownerUserId: readyOwner.id,
    storeId: readyStore.id,
    label: "ready-product",
  });
  const gatedProduct = await createFixtureProduct({
    ownerUserId: gatedOwner.id,
    storeId: gatedStore.id,
    label: "gated-product",
  });

  await verifyReadyScenario(readyStore, readyProduct);
  await verifyNotConfiguredScenario(gatedStore, gatedProduct);

  console.log("[mvf-store-readiness] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-store-readiness] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-store-readiness] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
