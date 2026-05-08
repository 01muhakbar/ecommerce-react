import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Order, OrderItem, Product, Store, User } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-seller-del-${Date.now()}`;

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
const createdOrderIds: number[] = [];
const createdOrderItemIds: number[] = [];

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const logStep = (label: string) => console.log(`[seller-delete] ${label}`);
const logPass = (label: string) => console.log(`[seller-delete] PASS ${label}`);

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, `[seller-delete] API not ready at ${BASE_URL}/api/health`);
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `Seller Delete ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password: DEFAULT_PASSWORD };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = slugify(`${RUN_ID}-${label}-store`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID} ${label} store`,
    slug,
    status: "ACTIVE",
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug };
}

async function createFixtureProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
  status?: "draft" | "active" | "inactive";
  isPublished?: boolean;
}) {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const product = await Product.create({
    name: `${RUN_ID} ${input.label}`,
    slug,
    sku: `${slug.toUpperCase()}-SKU`,
    price: 170000,
    salePrice: 150000,
    stock: 9,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: input.status || "draft",
    isPublished: Boolean(input.isPublished),
    sellerSubmissionStatus: "none",
    description: `Seller delete smoke ${input.label}.`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug, name: `${RUN_ID} ${input.label}` };
}

async function createReferencedOrder(userId: number, productId: number) {
  const order = await Order.create({
    invoiceNo: `${RUN_ID}-INV-${Date.now()}`,
    userId,
    checkoutMode: "LEGACY",
    totalAmount: 170000,
    subtotalAmount: 170000,
    shippingAmount: 0,
    serviceFeeAmount: 0,
    paymentStatus: "PAID",
    customerName: "Delete Smoke Buyer",
    customerPhone: "081234567890",
    customerAddress: "Delete smoke address",
    paymentMethod: "manual_transfer",
    status: "completed",
  } as any);
  const orderId = Number(order.getDataValue("id"));
  createdOrderIds.push(orderId);

  const orderItem = await OrderItem.create({
    orderId,
    productId,
    quantity: 1,
    price: 170000,
  } as any);
  createdOrderItemIds.push(Number(orderItem.getDataValue("id")));
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
  if (createdOrderItemIds.length > 0) {
    await OrderItem.destroy({ where: { id: createdOrderItemIds } as any, force: true } as any);
  }
  if (createdOrderIds.length > 0) {
    await Order.destroy({ where: { id: createdOrderIds } as any, force: true } as any);
  }
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
  const otherSellerUser = await createFixtureUser("seller-other");
  const buyerUser = await createFixtureUser("buyer");
  const sellerStore = await createFixtureStore(sellerUser.id, "seller");
  const otherStore = await createFixtureStore(otherSellerUser.id, "other");
  const draftProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: sellerStore.id,
    label: "draft-delete",
    status: "draft",
    isPublished: false,
  });
  const referencedProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: sellerStore.id,
    label: "history-archive",
    status: "active",
    isPublished: true,
  });
  const otherStoreProduct = await createFixtureProduct({
    ownerUserId: otherSellerUser.id,
    storeId: otherStore.id,
    label: "other-store",
    status: "draft",
    isPublished: false,
  });
  await createReferencedOrder(buyerUser.id, referencedProduct.id);

  const sellerClient = new CookieClient();
  const adminClient = new CookieClient();
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await loginAdmin(adminClient);

  logStep("hard delete seller draft product");
  const deleteDraftResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/products/${draftProduct.id}`,
    {
      method: "DELETE",
    }
  );
  assertStatus(deleteDraftResponse, 200, "seller delete draft");
  assert.equal(Boolean(deleteDraftResponse.body?.data?.deleted), true, "draft product should be deleted");
  assert.equal(Boolean(deleteDraftResponse.body?.data?.archived), false, "draft product should not archive");
  const deletedDraftRow = await Product.findByPk(draftProduct.id);
  assert.equal(deletedDraftRow, null, "draft product row should be removed");
  logPass("draft product hard deleted safely");

  logStep("seller list drops hard deleted product");
  const sellerListAfterDelete = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/products?keyword=${encodeURIComponent(RUN_ID)}&limit=20`
  );
  assertStatus(sellerListAfterDelete, 200, "seller list after hard delete");
  const sellerItemsAfterDelete: any[] = Array.isArray(sellerListAfterDelete.body?.data?.items)
    ? sellerListAfterDelete.body.data.items
    : [];
  assert.equal(
    sellerItemsAfterDelete.some((item) => Number(item?.id) === draftProduct.id),
    false,
    "hard deleted product should disappear from seller list"
  );
  logPass("seller list hides hard deleted product");

  logStep("archive referenced seller product");
  const archiveResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/products/${referencedProduct.id}`,
    {
      method: "DELETE",
    }
  );
  assertStatus(archiveResponse, 200, "seller archive referenced product");
  assert.equal(Boolean(archiveResponse.body?.data?.deleted), false, "referenced product should not hard delete");
  assert.equal(Boolean(archiveResponse.body?.data?.archived), true, "referenced product should archive");
  assert.equal(
    String(archiveResponse.body?.data?.archiveReason || ""),
    "ORDER_OR_REVIEW_HISTORY",
    "referenced product should archive because of history"
  );
  const archivedRow = await Product.findByPk(referencedProduct.id);
  assert.ok(archivedRow, "referenced product should remain for archive-safe policy");
  assert.equal(Boolean((archivedRow as any).get("isPublished")), false, "archived product should unpublish");
  assert.equal(String((archivedRow as any).get("status") || ""), "inactive", "archived product should become inactive");
  logPass("referenced product archives safely");

  logStep("admin list reflects seller archive");
  const adminList = await adminClient.request(
    `/api/admin/products?q=${encodeURIComponent(RUN_ID)}&page=1&limit=50`
  );
  assertStatus(adminList, 200, "admin list after seller delete/archive");
  const adminItems: any[] = Array.isArray(adminList.body?.data) ? adminList.body.data : [];
  assert.equal(
    adminItems.some((item) => Number(item?.id) === draftProduct.id),
    false,
    "admin list should not show hard deleted product"
  );
  const adminArchived = adminItems.find((item) => Number(item?.id) === referencedProduct.id);
  assert.ok(adminArchived, "admin list should still show archived product");
  assert.equal(Boolean(adminArchived?.published), false, "admin archived product should be unpublished");
  assert.equal(String(adminArchived?.status || ""), "inactive", "admin archived product should be inactive");
  logPass("admin list reflects seller delete/archive");

  logStep("storefront and public discovery hide deleted or archived products");
  const storefrontList = await fetch(
    `${BASE_URL}/api/store/products?search=${encodeURIComponent(RUN_ID)}&page=1&limit=20`
  ).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
  assert.equal(storefrontList.status, 200, "storefront list should load");
  const storefrontIds = Array.isArray(storefrontList.body?.data)
    ? storefrontList.body.data.map((item: any) => Number(item?.id))
    : [];
  assert.equal(
    storefrontIds.includes(draftProduct.id) || storefrontIds.includes(referencedProduct.id),
    false,
    "deleted or archived products should stay hidden from storefront discovery"
  );
  const publicList = await fetch(
    `${BASE_URL}/api/products?q=${encodeURIComponent(RUN_ID)}&page=1&limit=20`
  ).then(async (response) => ({
    status: response.status,
    body: await response.json(),
  }));
  assert.equal(publicList.status, 200, "public list should load");
  const publicIds = Array.isArray(publicList.body?.data?.items)
    ? publicList.body.data.items.map((item: any) => Number(item?.id))
    : [];
  assert.equal(
    publicIds.includes(draftProduct.id) || publicIds.includes(referencedProduct.id),
    false,
    "deleted or archived products should stay hidden from public discovery"
  );
  logPass("storefront/public discovery stay clean");

  logStep("cross-store delete is rejected");
  const crossStoreDelete = await sellerClient.request(
    `/api/seller/stores/${otherStore.id}/products/${otherStoreProduct.id}`,
    {
      method: "DELETE",
    }
  );
  assert.equal(
    crossStoreDelete.status === 403 || crossStoreDelete.status === 404,
    true,
    `cross-store delete should be rejected, received ${crossStoreDelete.status}`
  );
  logPass("cross-store delete is rejected");

  logStep("repeated delete is safe");
  const repeatedDelete = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/products/${draftProduct.id}`,
    {
      method: "DELETE",
    }
  );
  assertStatus(repeatedDelete, 200, "repeated delete");
  assert.equal(Boolean(repeatedDelete.body?.data?.alreadyDeleted), true, "repeated delete should report already deleted");
  logPass("repeated delete is safe");
}

main()
  .then(async () => {
    await cleanupFixtures();
    console.log("[seller-delete] DONE");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seller-delete] FAIL", error);
    await cleanupFixtures();
    process.exit(1);
  });
