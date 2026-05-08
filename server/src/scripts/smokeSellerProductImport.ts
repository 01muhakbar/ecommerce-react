import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { Category, Product, Store, User } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-seller-import-${Date.now()}`;

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
const createdCategoryIds: number[] = [];

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const logStep = (label: string) => console.log(`[seller-import] ${label}`);
const logPass = (label: string) => console.log(`[seller-import] PASS ${label}`);

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, `[seller-import] API not ready at ${BASE_URL}/api/health`);
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `Seller Import ${label}`,
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

async function createFixtureCategory() {
  const category = await Category.create({
    name: `${RUN_ID} category`,
    code: slugify(`${RUN_ID}-category`).slice(0, 50),
    published: true,
  } as any);
  const id = Number((category as any).get("id"));
  createdCategoryIds.push(id);
  return {
    id,
    name: String((category as any).get("name")),
    code: String((category as any).get("code")),
  };
}

async function createExistingProduct(ownerUserId: number, storeId: number) {
  const slug = slugify(`${RUN_ID}-existing`);
  const product = await Product.create({
    name: `${RUN_ID} existing`,
    slug,
    sku: `${slug.toUpperCase()}-SKU`,
    price: 170000,
    stock: 5,
    userId: ownerUserId,
    storeId,
    status: "draft",
    isPublished: false,
    sellerSubmissionStatus: "none",
  } as any);
  const id = Number((product as any).get("id"));
  createdProductIds.push(id);
  return {
    id,
    slug,
    sku: `${slug.toUpperCase()}-SKU`,
  };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
    headers: { "Content-Type": "application/json" },
  });
  assertStatus(response, 200, label);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    headers: { "Content-Type": "application/json" },
  });
  assertStatus(response, 200, "admin login");
}

async function cleanupFixtures() {
  if (createdProductIds.length > 0) {
    await Product.destroy({ where: { id: createdProductIds } as any, force: true } as any);
  }
  if (createdStoreIds.length > 0 || createdUserIds.length > 0) {
    await Product.destroy({
      where: {
        [createdStoreIds.length > 0 && createdUserIds.length > 0
          ? Op.or
          : createdStoreIds.length > 0
            ? "storeId"
            : "userId"]:
          createdStoreIds.length > 0 && createdUserIds.length > 0
            ? [
                { storeId: createdStoreIds },
                { userId: createdUserIds },
              ]
            : createdStoreIds.length > 0
              ? createdStoreIds
              : createdUserIds,
      } as any,
      force: true,
    } as any).catch(() => null);
  }
  if (createdCategoryIds.length > 0) {
    await Category.destroy({ where: { id: createdCategoryIds } as any, force: true } as any);
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
  const category = await createFixtureCategory();
  const existing = await createExistingProduct(sellerUser.id, store.id);

  const sellerClient = new CookieClient();
  const adminClient = new CookieClient();
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await loginAdmin(adminClient);

  logStep("import valid seller JSON file");
  const importPayload = {
    items: [
      {
        title: `${RUN_ID} imported`,
        slug: existing.slug,
        sku: existing.sku,
        price: 199000,
        salePrice: 179000,
        stock: 7,
        categoryId: category.id,
        description: "Seller import smoke product",
        storeId: store.id,
      },
    ],
  };
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([JSON.stringify(importPayload, null, 2)], { type: "application/json" }),
    "seller-import.json"
  );
  const importResponse = await sellerClient.request(`/api/seller/stores/${store.id}/products/import`, {
    method: "POST",
    body: formData,
  });
  assertStatus(importResponse, 200, "seller import");
  assert.equal(Number(importResponse.body?.data?.created || 0), 1, "import should create one product");
  assert.equal(Number(importResponse.body?.data?.failed || 0), 0, "valid import should not fail");
  logPass("valid seller JSON import accepted");

  logStep("seller list reflects imported draft");
  const sellerList = await sellerClient.request(
    `/api/seller/stores/${store.id}/products?keyword=${encodeURIComponent(RUN_ID)}&limit=20`
  );
  assertStatus(sellerList, 200, "seller list after import");
  const sellerItems: any[] = Array.isArray(sellerList.body?.data?.items) ? sellerList.body.data.items : [];
  const importedItem = sellerItems.find((item) => String(item?.name || "").includes("imported"));
  assert.ok(importedItem, "seller list missing imported product");
  createdProductIds.push(Number(importedItem.id));
  assert.equal(String(importedItem?.status || ""), "draft", "imported product should stay draft");
  assert.equal(Boolean(importedItem?.published), false, "imported product should stay unpublished");
  assert.equal(String(importedItem?.submission?.status || ""), "none", "imported product should not enter review automatically");
  assert.notEqual(String(importedItem?.slug || ""), existing.slug, "imported slug should stay unique");
  assert.notEqual(String(importedItem?.sku || ""), existing.sku, "imported sku should stay unique");
  logPass("seller list includes safe imported draft");

  logStep("admin list reflects imported product");
  const adminList = await adminClient.request(
    `/api/admin/products?q=${encodeURIComponent(RUN_ID)}&page=1&limit=50`
  );
  assertStatus(adminList, 200, "admin list after seller import");
  const adminItems: any[] = Array.isArray(adminList.body?.data) ? adminList.body.data : [];
  const adminImported = adminItems.find((item) => Number(item?.id) === Number(importedItem.id));
  assert.ok(adminImported, "admin list missing imported product");
  assert.equal(Boolean(adminImported?.published), false, "admin should see imported draft as unpublished");
  logPass("admin sees imported seller draft");

  logStep("storefront and public discovery hide imported draft");
  const storefrontList = await fetch(
    `${BASE_URL}/api/store/products?search=${encodeURIComponent(RUN_ID)}&page=1&limit=20`
  ).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
  assert.equal(storefrontList.status, 200, "storefront list should load");
  assert.equal(
    Array.isArray(storefrontList.body?.data)
      ? storefrontList.body.data.some((item: any) => Number(item?.id) === Number(importedItem.id))
      : false,
    false,
    "imported draft should stay hidden from storefront discovery"
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
      ? publicList.body.data.items.some((item: any) => Number(item?.id) === Number(importedItem.id))
      : false,
    false,
    "imported draft should stay hidden from public discovery"
  );
  logPass("imported draft stays hidden from storefront/public discovery");

  logStep("accept valid seller CSV file");
  const csvFormData = new FormData();
  csvFormData.append(
    "file",
    new Blob(
      [
        [
          "title,price,stock,categoryId,sku,slug",
          `\"${RUN_ID} csv imported\",149000,6,${category.id},${existing.sku},${slugify(`${RUN_ID}-csv-import`)}`,
        ].join("\n"),
      ],
      { type: "text/csv" }
    ),
    "seller-import.csv"
  );
  const csvImportResponse = await sellerClient.request(
    `/api/seller/stores/${store.id}/products/import`,
    {
      method: "POST",
      body: csvFormData,
    }
  );
  assertStatus(csvImportResponse, 200, "seller csv import");
  assert.equal(Number(csvImportResponse.body?.data?.created || 0), 1, "csv import should create one product");
  assert.equal(Number(csvImportResponse.body?.data?.failed || 0), 0, "csv import should not fail");
  logPass("valid seller CSV import accepted");

  logStep("reject malformed import file");
  const badFormData = new FormData();
  badFormData.append(
    "file",
    new Blob(['{"items": ['], { type: "application/json" }),
    "seller-import-invalid.json"
  );
  const badImportResponse = await sellerClient.request(
    `/api/seller/stores/${store.id}/products/import`,
    {
      method: "POST",
      body: badFormData,
    }
  );
  assertStatus(badImportResponse, 400, "invalid seller import");
  assert.equal(
    String(badImportResponse.body?.message || ""),
    "Invalid JSON file.",
    "malformed import should return JSON parse error"
  );
  logPass("malformed import file rejected");
}

main()
  .then(async () => {
    await cleanupFixtures();
    console.log("[seller-import] DONE");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seller-import] FAIL", error);
    await cleanupFixtures();
    process.exit(1);
  });
