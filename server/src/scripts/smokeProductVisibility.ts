import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import {
  Cart,
  CartItem,
  Product,
  Store,
  StoreMember,
  User,
  sequelize,
} from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf1-vis-${Date.now()}`;

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
  status: "ACTIVE" | "INACTIVE";
  ownerUserId: number;
};

type FixtureProduct = {
  id: number;
  name: string;
  slug: string;
  storeId: number;
  userId: number;
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

const toStoreListItems = (body: any) => (Array.isArray(body?.data) ? body.data : []);

const toPublicListItems = (body: any) =>
  Array.isArray(body?.data?.items) ? body.data.items : [];

const logPass = (label: string) => {
  console.log(`[mvf-visibility] PASS ${label}`);
};

const logStep = (label: string) => {
  console.log(`[mvf-visibility] ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

const assertListMissing = (items: any[], slug: string, label: string) => {
  assert.equal(
    items.some((item) => String(item?.slug || "") === slug),
    false,
    `${label}: ${slug} unexpectedly visible in list`
  );
};

const assertListVisible = (items: any[], slug: string, label: string) => {
  assert.equal(
    items.some((item) => String(item?.slug || "") === slug),
    true,
    `${label}: ${slug} missing from list`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, `[mvf-visibility] API not ready at ${BASE_URL}/api/health`);
}

async function createFixtureUser(label: string, role = "customer"): Promise<FixtureUser> {
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
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password };
}

async function createFixtureStore(
  ownerUserId: number,
  label: string,
  status: "ACTIVE" | "INACTIVE"
): Promise<FixtureStore> {
  const slug = slugify(`${RUN_ID}-${label}`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-${label}`,
    slug,
    status,
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug, status, ownerUserId };
}

async function createFixtureProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
  status: "active" | "inactive" | "draft";
  published: boolean;
  sellerSubmissionStatus: "none" | "submitted" | "needs_revision";
}): Promise<FixtureProduct> {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 10000,
    stock: 8,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: input.status,
    isPublished: input.published,
    sellerSubmissionStatus: input.sellerSubmissionStatus,
    description: `Fixture ${slug}`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return {
    id,
    name: slug,
    slug,
    storeId: input.storeId,
    userId: input.ownerUserId,
  };
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

async function fetchStoreList(search: string) {
  return new CookieClient().request(
    `/api/store/products?search=${encodeURIComponent(search)}&page=1&limit=20`
  );
}

async function fetchPublicList(search: string) {
  return new CookieClient().request(
    `/api/products?q=${encodeURIComponent(search)}&page=1&limit=20`
  );
}

async function assertHiddenEverywhere(product: FixtureProduct, label: string) {
  const storeList = await fetchStoreList(product.name);
  assertStatus(storeList, 200, `${label} storefront list`);
  assertListMissing(toStoreListItems(storeList.body), product.slug, `${label} storefront list`);

  const publicList = await fetchPublicList(product.name);
  assertStatus(publicList, 200, `${label} public list`);
  assertListMissing(toPublicListItems(publicList.body), product.slug, `${label} public list`);

  const storeDetail = await new CookieClient().request(
    `/api/store/products/${encodeURIComponent(product.slug)}`
  );
  assertStatus(storeDetail, 404, `${label} storefront detail`);

  const publicDetail = await new CookieClient().request(
    `/api/products/${encodeURIComponent(product.slug)}`
  );
  assertStatus(publicDetail, 404, `${label} public detail`);
}

async function assertVisibleEverywhere(product: FixtureProduct, label: string) {
  const storeList = await fetchStoreList(product.name);
  assertStatus(storeList, 200, `${label} storefront list`);
  assertListVisible(toStoreListItems(storeList.body), product.slug, `${label} storefront list`);

  const publicList = await fetchPublicList(product.name);
  assertStatus(publicList, 200, `${label} public list`);
  assertListVisible(toPublicListItems(publicList.body), product.slug, `${label} public list`);

  const storeDetail = await new CookieClient().request(
    `/api/store/products/${encodeURIComponent(product.slug)}`
  );
  assertStatus(storeDetail, 200, `${label} storefront detail`);
  assert.equal(
    String(storeDetail.body?.data?.slug || ""),
    product.slug,
    `${label}: storefront detail returned unexpected product`
  );

  const publicDetail = await new CookieClient().request(
    `/api/products/${encodeURIComponent(product.slug)}`
  );
  assertStatus(publicDetail, 200, `${label} public detail`);
  assert.equal(
    String(publicDetail.body?.data?.slug || ""),
    product.slug,
    `${label}: public detail returned unexpected product`
  );
}

async function resetCartForUser(userId: number) {
  const carts = await Cart.findAll({
    where: { userId } as any,
    attributes: ["id"],
  });
  const cartIds = carts
    .map((cart) => Number(cart.getDataValue("id")))
    .filter((cartId) => Number.isInteger(cartId) && cartId > 0);

  if (cartIds.length > 0) {
    await CartItem.destroy({
      where: { cartId: { [Op.in]: cartIds } } as any,
    });
    await Cart.destroy({
      where: { id: { [Op.in]: cartIds } } as any,
    });
  }
}

async function previewCart(
  customerClient: CookieClient,
  customerUserId: number,
  productId: number,
  label: string
) {
  await resetCartForUser(customerUserId);
  const addResponse = await customerClient.request("/api/cart/add", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  if (addResponse.status !== 200) {
    return {
      addResponse,
      previewResponse: null,
    };
  }

  const previewResponse = await customerClient.request("/api/checkout/preview", {
    method: "POST",
    body: JSON.stringify({}),
  });
  return {
    addResponse,
    previewResponse,
  };
}

async function cleanupFixtures() {
  if (createdUserIds.length > 0) {
    await resetCartForUser(createdUserIds[0]).catch(() => null);
  }

  if (createdUserIds.length > 1) {
    for (const userId of createdUserIds.slice(1)) {
      await resetCartForUser(userId).catch(() => null);
    }
  }

  if (createdProductIds.length > 0) {
    await Product.destroy({
      where: { id: { [Op.in]: createdProductIds } } as any,
      force: true,
    });
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
    });
  }

  if (createdUserIds.length > 0) {
    await User.destroy({
      where: { id: { [Op.in]: createdUserIds } } as any,
      force: true,
    });
  }
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();

  logStep("creating fixtures");
  const sellerUser = await createFixtureUser("seller-owner");
  const inactiveSellerUser = await createFixtureUser("inactive-owner");
  const customerUser = await createFixtureUser("customer");

  const activeStore = await createFixtureStore(sellerUser.id, "store-active", "ACTIVE");
  const inactiveStore = await createFixtureStore(
    inactiveSellerUser.id,
    "store-inactive",
    "INACTIVE"
  );

  const draftProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: activeStore.id,
    label: "draft-hidden",
    status: "draft",
    published: false,
    sellerSubmissionStatus: "none",
  });
  const inactiveProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: activeStore.id,
    label: "inactive-hidden",
    status: "inactive",
    published: true,
    sellerSubmissionStatus: "none",
  });
  const submittedProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: activeStore.id,
    label: "submitted-hidden",
    status: "active",
    published: true,
    sellerSubmissionStatus: "submitted",
  });
  const needsRevisionProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: activeStore.id,
    label: "needs-revision-hidden",
    status: "active",
    published: true,
    sellerSubmissionStatus: "needs_revision",
  });
  const visibleProduct = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: activeStore.id,
    label: "storefront-visible",
    status: "active",
    published: true,
    sellerSubmissionStatus: "none",
  });
  const inactiveStoreProduct = await createFixtureProduct({
    ownerUserId: inactiveSellerUser.id,
    storeId: inactiveStore.id,
    label: "store-inactive-hidden",
    status: "active",
    published: true,
    sellerSubmissionStatus: "none",
  });

  logStep("authenticating admin, seller, and customer clients");
  const adminClient = new CookieClient();
  const sellerClient = new CookieClient();
  const customerClient = new CookieClient();
  await loginAdmin(adminClient);
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await login(customerClient, customerUser.email, customerUser.password, "customer login");

  logStep("checking hidden scenarios on public/storefront routes");
  await assertHiddenEverywhere(draftProduct, "draft hidden");
  logPass("draft hidden");
  await assertHiddenEverywhere(inactiveProduct, "inactive hidden");
  logPass("inactive hidden");
  await assertHiddenEverywhere(submittedProduct, "submitted hidden");
  logPass("submitted hidden");
  await assertHiddenEverywhere(needsRevisionProduct, "needs revision hidden");
  logPass("needs revision hidden");
  await assertHiddenEverywhere(inactiveStoreProduct, "inactive store hidden");
  logPass("inactive store hidden");

  logStep("checking visible scenario on public/storefront routes");
  await assertVisibleEverywhere(visibleProduct, "visible product");
  logPass("visible product list/detail");

  logStep("checking admin review queue summary");
  const adminQueue = await adminClient.request(
    `/api/admin/products?q=${encodeURIComponent(RUN_ID)}&page=1&limit=50`
  );
  assertStatus(adminQueue, 200, "admin review queue summary");
  assert.equal(
    Number(adminQueue.body?.meta?.reviewQueue?.submitted || 0),
    1,
    "admin review queue: submitted count mismatch"
  );
  assert.equal(
    Number(adminQueue.body?.meta?.reviewQueue?.needsRevision || 0),
    1,
    "admin review queue: needs revision count mismatch"
  );
  assert.equal(
    Number(adminQueue.body?.meta?.reviewQueue?.total || 0),
    2,
    "admin review queue: total count mismatch"
  );
  logPass("admin review queue summary");

  logStep("checking checkout preview eligibility");
  const hiddenPreview = await previewCart(
    customerClient,
    customerUser.id,
    draftProduct.id,
    "draft preview"
  );
  if (hiddenPreview.addResponse.status === 409) {
    assert.equal(
      String(hiddenPreview.addResponse.body?.code || ""),
      "PRODUCT_NOT_AVAILABLE",
      "draft preview: hidden product returned unexpected add-to-cart rejection"
    );
  } else {
    assertStatus(hiddenPreview.addResponse, 200, "draft preview add to cart");
    assertStatus(hiddenPreview.previewResponse as JsonResponse, 200, "draft preview");
    assert.equal(
      Array.isArray(hiddenPreview.previewResponse?.body?.data?.invalidItems),
      true,
      "draft preview: invalidItems missing"
    );
    assert.equal(
      hiddenPreview.previewResponse?.body?.data?.invalidItems?.some(
        (item: any) => Number(item?.productId) === draftProduct.id
      ),
      true,
      "draft preview: hidden product was not marked invalid"
    );
  }
  logPass("draft checkout preview blocked");

  const visiblePreview = await previewCart(
    customerClient,
    customerUser.id,
    visibleProduct.id,
    "visible preview"
  );
  assertStatus(visiblePreview.addResponse, 200, "visible preview add to cart");
  assertStatus(visiblePreview.previewResponse as JsonResponse, 200, "visible preview");
  assert.equal(
    visiblePreview.previewResponse?.body?.data?.invalidItems?.length || 0,
    0,
    "visible preview: visible product unexpectedly invalid"
  );
  assert.equal(
    visiblePreview.previewResponse?.body?.data?.groups?.some((group: any) =>
      Array.isArray(group?.items)
        ? group.items.some((item: any) => Number(item?.productId) === visibleProduct.id)
        : false
    ),
    true,
    "visible preview: visible product missing from checkout groups"
  );
  logPass("visible checkout preview allowed");

  logStep("checking seller visibility metadata");
  const sellerList = await sellerClient.request(
    `/api/seller/stores/${activeStore.id}/products?keyword=${encodeURIComponent(RUN_ID)}&limit=20`
  );
  assertStatus(sellerList, 200, "seller list");
  const sellerItems: any[] = Array.isArray(sellerList.body?.data?.items)
    ? sellerList.body.data.items
    : [];
  const itemBySlug = new Map<string, any>(
    sellerItems.map((item: any) => [String(item?.slug || ""), item])
  );
  const submittedItem: any = itemBySlug.get(submittedProduct.slug);
  const needsRevisionItem: any = itemBySlug.get(needsRevisionProduct.slug);
  const visibleItem: any = itemBySlug.get(visibleProduct.slug);
  assert.ok(submittedItem, "seller list: submitted item missing");
  assert.ok(needsRevisionItem, "seller list: needs_revision item missing");
  assert.ok(visibleItem, "seller list: visible item missing");
  assert.equal(
    Boolean(submittedItem?.visibility?.storefrontVisible),
    false,
    "seller list: submitted product incorrectly marked visible"
  );
  assert.equal(
    String(submittedItem?.visibility?.stateCode || ""),
    "PUBLISHED_BLOCKED",
    "seller list: submitted product state mismatch"
  );
  assert.equal(
    Boolean(needsRevisionItem?.visibility?.storefrontVisible),
    false,
    "seller list: needs_revision product incorrectly marked visible"
  );
  assert.equal(
    String(needsRevisionItem?.visibility?.stateCode || ""),
    "PUBLISHED_BLOCKED",
    "seller list: needs_revision product state mismatch"
  );
  assert.equal(
    Boolean(visibleItem?.visibility?.storefrontVisible),
    true,
    "seller list: visible product should remain storefront visible"
  );
  assert.equal(
    String(visibleItem?.visibility?.stateCode || ""),
    "STOREFRONT_VISIBLE",
    "seller list: visible product state mismatch"
  );
  logPass("seller visibility metadata");

  logStep("checking seller review locks");
  const submittedEditLock = await sellerClient.request(
    `/api/seller/stores/${activeStore.id}/products/${submittedProduct.id}/draft`,
    {
      method: "PATCH",
      body: JSON.stringify({ name: `${submittedProduct.name} locked` }),
    }
  );
  assertStatus(submittedEditLock, 409, "seller submitted edit lock");
  assert.equal(
    String(submittedEditLock.body?.code || ""),
    "SELLER_PRODUCT_SUBMISSION_LOCKED",
    "seller submitted edit lock: wrong error code"
  );
  const submittedPublishLock = await sellerClient.request(
    `/api/seller/stores/${activeStore.id}/products/${submittedProduct.id}/published`,
    {
      method: "PATCH",
      body: JSON.stringify({ published: false }),
    }
  );
  assertStatus(submittedPublishLock, 409, "seller submitted publish lock");
  assert.equal(
    String(submittedPublishLock.body?.code || ""),
    "SELLER_PRODUCT_REVIEW_LOCKED",
    "seller submitted publish lock: wrong error code"
  );
  const needsRevisionPublishLock = await sellerClient.request(
    `/api/seller/stores/${activeStore.id}/products/${needsRevisionProduct.id}/published`,
    {
      method: "PATCH",
      body: JSON.stringify({ published: false }),
    }
  );
  assertStatus(needsRevisionPublishLock, 409, "seller needs revision publish lock");
  assert.equal(
    String(needsRevisionPublishLock.body?.code || ""),
    "SELLER_PRODUCT_REVIEW_LOCKED",
    "seller needs revision publish lock: wrong error code"
  );
  logPass("seller review locks");

  logStep("checking admin unpublish removes visibility immediately");
  const unpublishResponse = await adminClient.request(
    `/api/admin/products/${visibleProduct.id}/published`,
    {
      method: "PATCH",
      body: JSON.stringify({ published: false }),
    }
  );
  assertStatus(unpublishResponse, 200, "admin unpublish");
  await assertHiddenEverywhere(visibleProduct, "admin unpublish");
  const unpublishedPreview = await previewCart(
    customerClient,
    customerUser.id,
    visibleProduct.id,
    "admin unpublish preview"
  );
  if (unpublishedPreview.addResponse.status === 409) {
    assert.equal(
      String(unpublishedPreview.addResponse.body?.code || ""),
      "PRODUCT_NOT_AVAILABLE",
      "admin unpublish preview: hidden product returned unexpected add-to-cart rejection"
    );
  } else {
    assertStatus(
      unpublishedPreview.addResponse,
      200,
      "admin unpublish preview add to cart"
    );
    assertStatus(
      unpublishedPreview.previewResponse as JsonResponse,
      200,
      "admin unpublish preview"
    );
    assert.equal(
      unpublishedPreview.previewResponse?.body?.data?.invalidItems?.some(
        (item: any) => Number(item?.productId) === visibleProduct.id
      ),
      true,
      "admin unpublish preview: unpublished product still treated as purchasable"
    );
  }
  logPass("admin unpublish immediate removal");

  console.log("[mvf-visibility] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-visibility] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupFixtures();
    } catch (cleanupError) {
      console.error("[mvf-visibility] cleanup failed", cleanupError);
      process.exitCode = 1;
    }
    try {
      await sequelize.close();
    } catch {
      // ignore close failures in smoke cleanup
    }
  });
