import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Category, Product, Store, User } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-product-activity-${Date.now()}`;

class CookieClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (this.cookie) headers.set("Cookie", this.cookie);

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
    return { status: response.status, ok: response.ok, body, text };
  }
}

const createdUserIds: number[] = [];
const createdStoreIds: number[] = [];
const createdCategoryIds: number[] = [];
const createdProductIds: number[] = [];

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const log = (message: string) => console.log(`[product-activity] ${message}`);

const assertStatus = (response: any, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, "API not ready.");
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const password = DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: `Product Activity ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number((user as any).get("id"));
  createdUserIds.push(id);
  return { id, email, password };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID} ${label} Store`,
    slug: slugify(`${RUN_ID}-${label}-store`),
    status: "ACTIVE",
  } as any);
  const id = Number((store as any).get("id"));
  createdStoreIds.push(id);
  return {
    id,
    slug: String((store as any).get("slug")),
  };
}

async function createFixtureCategory() {
  const category = await Category.create({
    name: `${RUN_ID} category`,
    code: slugify(`${RUN_ID}-category`).slice(0, 50),
    published: true,
  } as any);
  const id = Number((category as any).get("id"));
  createdCategoryIds.push(id);
  return { id };
}

async function loginSeller(client: CookieClient, email: string, password: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, "seller login");
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function getActivity(client: CookieClient, productId: number) {
  const response = await client.request(`/api/products/${productId}/activity?limit=50&offset=0`);
  assertStatus(response, 200, `activity for product ${productId}`);
  return Array.isArray(response.body?.data?.items) ? response.body.data.items : [];
}

async function cleanupFixtures() {
  if (createdProductIds.length > 0) {
    await Product.destroy({
      where: { id: createdProductIds } as any,
      force: true,
    } as any);
  }
  if (createdStoreIds.length > 0) {
    await Store.destroy({ where: { id: createdStoreIds } as any, force: true } as any);
  }
  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: createdUserIds } as any, force: true } as any);
  }
  if (createdCategoryIds.length > 0) {
    await Category.destroy({ where: { id: createdCategoryIds } as any, force: true } as any);
  }
}

async function main() {
  await ensureServerReady();

  const sellerOne = await createFixtureUser("seller-one");
  const sellerTwo = await createFixtureUser("seller-two");
  const storeOne = await createFixtureStore(sellerOne.id, "one");
  const storeTwo = await createFixtureStore(sellerTwo.id, "two");
  const category = await createFixtureCategory();

  const sellerClient = new CookieClient();
  const otherSellerClient = new CookieClient();
  const adminClient = new CookieClient();

  await loginSeller(sellerClient, sellerOne.email, sellerOne.password);
  await loginSeller(otherSellerClient, sellerTwo.email, sellerTwo.password);
  await loginAdmin(adminClient);

  log("create seller draft");
  const createResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/drafts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${RUN_ID} Draft`,
        slug: slugify(`${RUN_ID} Draft`),
        price: 125000,
        stock: 6,
        categoryIds: [category.id],
        defaultCategoryId: category.id,
      }),
    }
  );
  assertStatus(createResponse, 201, "seller draft create");
  const productId = Number(createResponse.body?.data?.id || 0);
  createdProductIds.push(productId);

  log("update seller draft");
  const updateResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${productId}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${RUN_ID} Draft Updated`,
        slug: slugify(`${RUN_ID} Draft Updated`),
        price: 150000,
        stock: 8,
        categoryIds: [category.id],
        defaultCategoryId: category.id,
      }),
    }
  );
  assertStatus(updateResponse, 200, "seller draft update");

  log("duplicate seller draft");
  const duplicateResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${productId}/duplicate`,
    {
      method: "POST",
    }
  );
  assertStatus(duplicateResponse, 201, "seller duplicate");
  const duplicateId = Number(duplicateResponse.body?.data?.id || 0);
  createdProductIds.push(duplicateId);

  log("submit original draft for review");
  const submitResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${productId}/submit-review`,
    {
      method: "POST",
    }
  );
  assertStatus(submitResponse, 200, "seller submit review");

  log("admin rejects submitted review");
  const rejectResponse = await adminClient.request(
    `/api/admin/products/${productId}/revision-request`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: "Please revise activity smoke." }),
    }
  );
  assertStatus(rejectResponse, 200, "admin revision request");

  log("create second review product for admin approval");
  const approveSourceResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/drafts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${RUN_ID} Approval Draft`,
        slug: slugify(`${RUN_ID} Approval Draft`),
        price: 99000,
        stock: 3,
        categoryIds: [category.id],
        defaultCategoryId: category.id,
      }),
    }
  );
  assertStatus(approveSourceResponse, 201, "seller approval draft create");
  const approveProductId = Number(approveSourceResponse.body?.data?.id || 0);
  createdProductIds.push(approveProductId);

  const approveSubmitResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${approveProductId}/submit-review`,
    {
      method: "POST",
    }
  );
  assertStatus(approveSubmitResponse, 200, "seller approval draft submit");

  log("admin approves review by publishing");
  const adminPublishResponse = await adminClient.request(
    `/api/admin/products/${approveProductId}/published`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: true }),
    }
  );
  assertStatus(adminPublishResponse, 200, "admin approve publish");

  log("publish duplicate product from seller");
  const duplicateUpdateResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${duplicateId}/draft`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${RUN_ID} Duplicate Active`,
        slug: slugify(`${RUN_ID} Duplicate Active`),
        price: 170000,
        stock: 5,
        categoryIds: [category.id],
        defaultCategoryId: category.id,
      }),
    }
  );
  assertStatus(duplicateUpdateResponse, 200, "duplicate update active");
  const duplicatePublishResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${duplicateId}/published`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: true }),
    }
  );
  assertStatus(duplicatePublishResponse, 200, "seller publish duplicate");

  log("archive published duplicate via seller delete");
  const archiveResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${duplicateId}`,
    {
      method: "DELETE",
    }
  );
  assertStatus(archiveResponse, 200, "seller archive duplicate");
  assert.equal(Boolean(archiveResponse.body?.data?.archived), true, "Expected archive path");

  log("create and hard delete seller draft");
  const deleteSourceResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/drafts`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${RUN_ID} Delete Draft`,
        slug: slugify(`${RUN_ID} Delete Draft`),
        price: 87000,
        stock: 2,
        categoryIds: [category.id],
        defaultCategoryId: category.id,
      }),
    }
  );
  assertStatus(deleteSourceResponse, 201, "seller delete draft create");
  const deleteProductId = Number(deleteSourceResponse.body?.data?.id || 0);
  createdProductIds.push(deleteProductId);
  const deleteResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/${deleteProductId}`,
    {
      method: "DELETE",
    }
  );
  assertStatus(deleteResponse, 200, "seller hard delete");
  assert.equal(Boolean(deleteResponse.body?.data?.deleted), true, "Expected hard delete");

  log("import seller product via json");
  const importForm = new FormData();
  importForm.append(
    "file",
    new Blob(
      [
        JSON.stringify([
          {
            name: `${RUN_ID} Imported`,
            slug: slugify(`${RUN_ID} Imported`),
            price: 111000,
            stock: 4,
            categoryId: category.id,
          },
        ]),
      ],
      { type: "application/json" }
    ),
    `${RUN_ID}.json`
  );
  const importResponse = await sellerClient.request(
    `/api/seller/stores/${storeOne.id}/products/import`,
    {
      method: "POST",
      body: importForm,
    }
  );
  assertStatus(importResponse, 200, "seller import");
  const importedProduct = await Product.findOne({
    where: { slug: slugify(`${RUN_ID} Imported`), storeId: storeOne.id } as any,
  });
  assert.ok(importedProduct, "Imported product missing.");
  const importedProductId = Number((importedProduct as any).get("id"));
  createdProductIds.push(importedProductId);

  log("assert activity payloads");
  const originalActivity = await getActivity(sellerClient, productId);
  assert.ok(
    originalActivity.some((entry: any) => entry.action === "PRODUCT_CREATED"),
    "Missing PRODUCT_CREATED log."
  );
  assert.ok(
    originalActivity.some((entry: any) => entry.action === "PRODUCT_UPDATED"),
    "Missing PRODUCT_UPDATED log."
  );
  assert.ok(
    originalActivity.some((entry: any) => entry.action === "PRODUCT_SUBMITTED_FOR_REVIEW"),
    "Missing PRODUCT_SUBMITTED_FOR_REVIEW log."
  );
  assert.ok(
    originalActivity.some((entry: any) => entry.action === "PRODUCT_REVIEW_REJECTED"),
    "Missing PRODUCT_REVIEW_REJECTED log."
  );

  const approveActivity = await getActivity(adminClient, approveProductId);
  assert.ok(
    approveActivity.some((entry: any) => entry.action === "PRODUCT_REVIEW_APPROVED"),
    "Missing PRODUCT_REVIEW_APPROVED log."
  );
  assert.ok(
    approveActivity.some((entry: any) => entry.action === "PRODUCT_PUBLISHED"),
    "Missing PRODUCT_PUBLISHED log."
  );

  const duplicateActivity = await getActivity(sellerClient, duplicateId);
  assert.ok(
    duplicateActivity.some((entry: any) => entry.action === "PRODUCT_DUPLICATED"),
    "Missing PRODUCT_DUPLICATED log."
  );
  assert.ok(
    duplicateActivity.some((entry: any) => entry.action === "PRODUCT_ARCHIVED"),
    "Missing PRODUCT_ARCHIVED log."
  );

  const deletedActivity = await getActivity(sellerClient, deleteProductId);
  assert.ok(
    deletedActivity.some((entry: any) => entry.action === "PRODUCT_DELETED"),
    "Missing PRODUCT_DELETED log."
  );

  const importedActivity = await getActivity(sellerClient, importedProductId);
  assert.ok(
    importedActivity.some((entry: any) => entry.action === "PRODUCT_IMPORTED"),
    "Missing PRODUCT_IMPORTED log."
  );

  log("assert seller cross-store access denied");
  const forbiddenActivity = await otherSellerClient.request(
    `/api/products/${productId}/activity?limit=20&offset=0`
  );
  assert.equal(forbiddenActivity.status, 403, `Expected 403, got ${forbiddenActivity.status}`);

  log("PASS product activity logging smoke");
}

main()
  .catch((error) => {
    console.error("[product-activity] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((error) => {
      console.error("[product-activity] cleanup failed", error);
    });
  });
