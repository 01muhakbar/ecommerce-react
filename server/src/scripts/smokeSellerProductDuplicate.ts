import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Product, Store, User } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-seller-dup-${Date.now()}`;

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
const createdProductIds: number[] = [];

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const logStep = (label: string) => console.log(`[seller-duplicate] ${label}`);
const logPass = (label: string) => console.log(`[seller-duplicate] PASS ${label}`);

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, `[seller-duplicate] API not ready at ${BASE_URL}/api/health`);
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `Seller Duplicate ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password: DEFAULT_PASSWORD };
}

async function createFixtureStore(ownerUserId: number) {
  const slug = slugify(`${RUN_ID}-store`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID} store`,
    slug,
    status: "ACTIVE",
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug };
}

async function createSourceProduct(ownerUserId: number, storeId: number) {
  const slug = slugify(`${RUN_ID}-source`);
  const product = await Product.create({
    name: `${RUN_ID} source`,
    slug,
    sku: `${slug.toUpperCase()}-SKU`,
    barcode: `${slug.toUpperCase()}-BARCODE`,
    price: 170000,
    salePrice: 150000,
    stock: 9,
    userId: ownerUserId,
    storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "needs_revision",
    sellerRevisionNote: "Update packaging copy before approval.",
    description: "Seller duplicate smoke source product.",
    variations: {
      groups: [{ id: 1, name: "Color", values: [{ id: 11, label: "Red" }] }],
      variants: [
        {
          variantId: 88,
          productId: 99999,
          sku: `${slug.toUpperCase()}-RED`,
          selections: [{ attributeId: 1, valueId: 11 }],
        },
      ],
    },
    wholesale: {
      tiers: [{ minQty: 5, price: 145000 }],
      productId: 99999,
    },
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug, name: `${RUN_ID} source` };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function cleanupFixtures() {
  if (createdProductIds.length > 0) {
    await Product.destroy({ where: { id: createdProductIds } as any, force: true } as any);
  }
  if (createdStoreIds.length > 0) {
    await Store.destroy({ where: { id: createdStoreIds } as any, force: true } as any);
  }
  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: createdUserIds } as any, force: true } as any);
  }
}

async function main() {
  await ensureServerReady();

  const sellerUser = await createFixtureUser("seller");
  const store = await createFixtureStore(sellerUser.id);
  const sourceProduct = await createSourceProduct(sellerUser.id, store.id);

  const sellerClient = new CookieClient();
  const adminClient = new CookieClient();
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await loginAdmin(adminClient);

  logStep("duplicate seller product");
  const duplicateResponse = await sellerClient.request(
    `/api/seller/stores/${store.id}/products/${sourceProduct.id}/duplicate`,
    {
      method: "POST",
    }
  );
  assertStatus(duplicateResponse, 201, "seller duplicate");
  const duplicated = duplicateResponse.body?.data;
  assert.ok(duplicated?.id, "duplicate response missing product id");
  createdProductIds.push(Number(duplicated.id));

  assert.equal(Number(duplicated?.storeId || 0), store.id, "duplicate store scope mismatch");
  assert.equal(String(duplicated?.status || ""), "draft", "duplicate status should reset to draft");
  assert.equal(Boolean(duplicated?.published), false, "duplicate should reset published=false");
  assert.equal(
    String(duplicated?.submission?.status || ""),
    "none",
    "duplicate should reset seller submission state"
  );
  assert.equal(
    duplicated?.submission?.revisionNote || duplicated?.submission?.reviewNote || null,
    null,
    "duplicate should clear review note"
  );
  assert.notEqual(String(duplicated?.slug || ""), sourceProduct.slug, "duplicate slug must be unique");
  assert.ok(String(duplicated?.slug || "").includes("copy"), "duplicate slug should include copy suffix");
  assert.notEqual(
    String(duplicated?.sku || ""),
    `${sourceProduct.slug.toUpperCase()}-SKU`,
    "duplicate sku must be unique"
  );
  assert.equal(
    duplicated?.attributes?.barcode ?? null,
    null,
    "duplicate should clear barcode for safe copy"
  );
  assert.equal(
    duplicated?.variations?.raw?.variants?.[0]?.productId ?? null,
    null,
    "duplicate variations should not retain source productId"
  );
  assert.equal(
    duplicated?.variations?.raw?.variants?.[0]?.variantId ?? null,
    null,
    "duplicate variations should not retain variantId"
  );
  assert.equal(
    duplicated?.wholesale?.raw?.productId ?? null,
    null,
    "duplicate wholesale should not retain source productId"
  );
  logPass("duplicate response resets draft safely");

  logStep("seller list reflects duplicate");
  const sellerList = await sellerClient.request(
    `/api/seller/stores/${store.id}/products?keyword=${encodeURIComponent(RUN_ID)}&limit=20`
  );
  assertStatus(sellerList, 200, "seller list after duplicate");
  const sellerItems: any[] = Array.isArray(sellerList.body?.data?.items) ? sellerList.body.data.items : [];
  const duplicatedListItem = sellerItems.find((item) => Number(item?.id) === Number(duplicated.id));
  assert.ok(duplicatedListItem, "seller list missing duplicated row");
  assert.equal(String(duplicatedListItem?.status || ""), "draft", "seller list duplicate status mismatch");
  assert.equal(
    Boolean(duplicatedListItem?.published),
    false,
    "seller list duplicate published mismatch"
  );
  logPass("seller list includes duplicate");

  logStep("admin list reflects duplicate");
  const adminList = await adminClient.request(
    `/api/admin/products?q=${encodeURIComponent(RUN_ID)}&page=1&limit=50`
  );
  assertStatus(adminList, 200, "admin list after duplicate");
  const adminItems: any[] = Array.isArray(adminList.body?.data) ? adminList.body.data : [];
  const adminDuplicate = adminItems.find((item) => Number(item?.id) === Number(duplicated.id));
  assert.ok(adminDuplicate, "admin list missing duplicated row");
  assert.equal(Boolean(adminDuplicate?.published), false, "admin list duplicate published mismatch");
  logPass("admin list includes duplicate");

  logStep("duplicate remains hidden from storefront/public discovery");
  const storefrontList = await fetch(
    `${BASE_URL}/api/store/products?search=${encodeURIComponent(RUN_ID)}&page=1&limit=20`
  ).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
  assert.equal(storefrontList.status, 200, "storefront list should load");
  assert.equal(
    Array.isArray(storefrontList.body?.data)
      ? storefrontList.body.data.some((item: any) => Number(item?.id) === Number(duplicated.id))
      : false,
    false,
    "duplicated draft should stay hidden from storefront discovery"
  );
  const publicList = await fetch(
    `${BASE_URL}/api/products?q=${encodeURIComponent(RUN_ID)}&page=1&limit=20`
  ).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
  assert.equal(publicList.status, 200, "public list should load");
  assert.equal(
    Array.isArray(publicList.body?.data?.items)
      ? publicList.body.data.items.some((item: any) => Number(item?.id) === Number(duplicated.id))
      : false,
    false,
    "duplicated draft should stay hidden from public discovery"
  );
  logPass("duplicate stays hidden from storefront/public discovery");
}

main()
  .then(async () => {
    await cleanupFixtures();
    console.log("[seller-duplicate] DONE");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seller-duplicate] FAIL", error);
    await cleanupFixtures();
    process.exit(1);
  });
