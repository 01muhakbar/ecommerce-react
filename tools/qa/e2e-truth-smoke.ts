import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Op } from "sequelize";
import { config as loadEnv } from "dotenv";

const APP_HOST = "127.0.0.1";
const API_PORT = 3001;
const DEFAULT_PASSWORD = "mvf-smoke-123";
const DEFAULT_PASSWORD_HASH = "$2b$10$BlVCXo.I/DrWMs53W064U.NoNdPrHgxb3wvg3oy0AQmhwE7SEB33.";
const RUN_ID = `e2e-truth-${Date.now()}`;
const serverEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../server/.env"
);

loadEnv({ path: serverEnvPath });

let clientPort = 0;
let clientBase = "";
let clientOrigin = "";

let app: any;
let sequelize: any;
let User: any;
let Store: any;
let StoreMember: any;
let StorePaymentProfile: any;
let Product: any;
let Cart: any;
let CartItem: any;
let Order: any;
let OrderItem: any;
let Payment: any;
let PaymentProof: any;
let PaymentStatusLog: any;
let Suborder: any;
let SuborderItem: any;

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

type CheckoutScenario = {
  orderId: number;
  invoiceNo: string;
  suborderId: number;
  paymentId: number;
};

class CookieClient {
  private cookie = "";

  getCookieHeader() {
    return this.cookie;
  }

  async request(pathname: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) headers.set("Cookie", this.cookie);

    const response = await fetch(`${`http://${APP_HOST}:${API_PORT}`}${pathname}`, {
      ...init,
      headers,
    });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] || this.cookie;

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
const createdPaymentProfileIds: number[] = [];
const createdProductIds: number[] = [];
const createdOrderIds: number[] = [];

const log = (message: string) => console.log(`[e2e-truth] ${message}`);

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

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const waitFor = async (url: string, timeoutMs = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) return true;
    } catch {
      // retry
    }
    await delay(500);
  }
  return false;
};

const withTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number, label: string) => {
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  });
  return Promise.race([fn(), timeout]) as Promise<T>;
};

const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, APP_HOST, () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        server.close();
        reject(new Error("Unable to allocate free port."));
        return;
      }
      const port = Number(address.port);
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

const stopProcessTree = (proc: any) =>
  new Promise<void>((resolve) => {
    if (!proc || proc.killed) return resolve();
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      return;
    }
    proc.kill("SIGINT");
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
      resolve();
    }, 5000);
  });

async function ensurePortAvailable(port: number) {
  return new Promise<void>((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", (error: any) => {
      reject(new Error(`Port ${port} is unavailable: ${error?.message || error}`));
    });
    tester.once("listening", () => {
      tester.close(() => resolve());
    });
    tester.listen(port, APP_HOST);
  });
}

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is not installed. Run `pnpm qa:ui:install` first.");
  }
};

const withEnv = async (
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>
) => {
  const originalEntries = Object.entries(overrides).map(([key]) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "undefined") delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of originalEntries) {
      if (typeof value === "undefined") delete process.env[key];
      else process.env[key] = value;
    }
  }
};

async function ensureServerModules() {
  if (app && sequelize && User && Store && StorePaymentProfile && Product) return;
  const appModule = await import("../../server/src/app.js");
  const modelsModule = await import("../../server/src/models/index.js");
  app = appModule.default;
  sequelize = modelsModule.sequelize;
  User = modelsModule.User;
  Store = modelsModule.Store;
  StoreMember = modelsModule.StoreMember;
  StorePaymentProfile = modelsModule.StorePaymentProfile;
  Product = modelsModule.Product;
  Cart = modelsModule.Cart;
  CartItem = modelsModule.CartItem;
  Order = modelsModule.Order;
  OrderItem = modelsModule.OrderItem;
  Payment = modelsModule.Payment;
  PaymentProof = modelsModule.PaymentProof;
  PaymentStatusLog = modelsModule.PaymentStatusLog;
  Suborder = modelsModule.Suborder;
  SuborderItem = modelsModule.SuborderItem;
}

async function createFixtureUser(label: string, role = "customer"): Promise<FixtureUser> {
  const email = `${RUN_ID}-${label}@local.dev`;
  const password = DEFAULT_PASSWORD;
  const user = await User.create({
    name: `E2E ${label}`,
    email,
    password: DEFAULT_PASSWORD_HASH,
    role,
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = slugify(`${RUN_ID}-${label}`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-${label}`,
    slug,
    status: "ACTIVE",
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug, name: String(store.getDataValue("name") || slug) };
}

async function createFixturePaymentProfile(storeId: number) {
  const now = new Date();
  const profile = await StorePaymentProfile.create({
    storeId,
    providerCode: "MANUAL_QRIS",
    paymentType: "QRIS_STATIC",
    version: 1,
    snapshotStatus: "ACTIVE",
    accountName: `E2E Account ${storeId}`,
    merchantName: `E2E Merchant ${storeId}`,
    merchantId: `E2E-${storeId}`,
    qrisImageUrl: `https://example.com/${RUN_ID}-${storeId}.png`,
    qrisPayload: `${RUN_ID}-${storeId}-payload`,
    instructionText: "Transfer exactly the shown amount.",
    isActive: true,
    verificationStatus: "ACTIVE",
    verifiedAt: now,
    activatedAt: now,
  } as any);
  const id = Number(profile.getDataValue("id"));
  createdPaymentProfileIds.push(id);
  await Store.update({ activeStorePaymentProfileId: id } as any, { where: { id: storeId } as any });
  return { id };
}

async function createFixtureProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
}) {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 125000,
    stock: 20,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug, name: String(product.getDataValue("name") || slug) };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: login did not return success`);
}

async function loginAdmin(client: CookieClient, email: string, password: string) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, "admin login");
  assert.ok(response.body?.user?.id, "admin login: user payload missing");
}

async function resetCartForUser(userId: number) {
  const carts = await Cart.findAll({
    where: { userId } as any,
    attributes: ["id"],
  });
  const cartIds = carts
    .map((cart: any) => Number(cart.getDataValue("id")))
    .filter((cartId: number) => Number.isInteger(cartId) && cartId > 0);

  if (cartIds.length > 0) {
    await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } } as any });
    await Cart.destroy({ where: { id: { [Op.in]: cartIds } } as any });
  }
}

function buildShippingDetails(label: string) {
  return {
    fullName: `E2E ${label}`,
    phoneNumber: "081234567890",
    province: "Jakarta",
    city: "Jakarta Selatan",
    district: "Kebayoran Baru",
    postalCode: "12190",
    streetName: "E2E Street",
    houseNumber: "12",
    building: "Tower A",
    otherDetails: `Suite ${label}`,
    markAs: "HOME",
  };
}

async function addProductToCart(customerClient: CookieClient, buyerUserId: number, productId: number) {
  await resetCartForUser(buyerUserId);
  const response = await customerClient.request("/api/cart/add", {
    method: "POST",
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  assertStatus(response, 200, "add product to cart");
}

function getSingleGroup(data: any, label: string) {
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  assert.equal(groups.length, 1, `${label}: expected exactly one checkout group`);
  return groups[0];
}

async function createCheckoutOrder(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  label: string;
}): Promise<CheckoutScenario> {
  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  const shippingDetails = buildShippingDetails(input.label);
  const response = await input.customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        name: shippingDetails.fullName,
        phone: shippingDetails.phoneNumber,
        address: `${shippingDetails.streetName} ${shippingDetails.houseNumber}`,
        notes: `E2E ${input.label}`,
      },
      shippingDetails,
    }),
  });
  assertStatus(response, 201, `${input.label} create checkout`);
  assert.equal(Boolean(response.body?.success), true, `${input.label}: checkout did not return success`);
  const data = response.body?.data ?? null;
  const group = getSingleGroup(data, `${input.label} checkout`);
  const orderId = toNumber(data?.orderId, 0);
  const suborderId = toNumber(group?.suborderId, 0);
  const paymentId = toNumber(group?.payment?.id, 0);
  assert.ok(orderId > 0, `${input.label}: orderId missing`);
  assert.ok(suborderId > 0, `${input.label}: suborderId missing`);
  assert.ok(paymentId > 0, `${input.label}: paymentId missing`);
  createdOrderIds.push(orderId);
  return {
    orderId,
    invoiceNo: String(data?.invoiceNo || data?.ref || orderId),
    suborderId,
    paymentId,
  };
}

async function submitProof(customerClient: CookieClient, paymentId: number, label: string) {
  const response = await customerClient.request(`/api/payments/${paymentId}/proof`, {
    method: "POST",
    body: JSON.stringify({
      proofImageUrl: `https://example.com/${RUN_ID}-${label}.png`,
      senderName: `Buyer ${label}`,
      senderBankOrWallet: "Bank E2E",
      transferAmount: 125000,
      transferTime: new Date().toISOString(),
      note: `Proof ${label}`,
    }),
  });
  assertStatus(response, 201, `${label} submit proof`);
  assert.equal(Boolean(response.body?.success), true, `${label}: proof submit missing success`);
}

async function reviewPayment(
  sellerClient: CookieClient,
  storeId: number,
  paymentId: number,
  action: "APPROVE" | "REJECT",
  label: string
) {
  const response = await sellerClient.request(
    `/api/seller/stores/${storeId}/payments/${paymentId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action,
        note: `${label} ${action.toLowerCase()}`,
      }),
    }
  );
  assertStatus(response, 200, `${label} ${action.toLowerCase()}`);
  assert.equal(Boolean(response.body?.success), true, `${label}: review response missing success`);
}

async function fetchCheckoutPreview(customerClient: CookieClient) {
  const response = await customerClient.request("/api/checkout/preview", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assertStatus(response, 200, "checkout preview");
  assert.equal(Boolean(response.body?.success), true, "checkout preview: success flag missing");
  return response.body?.data ?? null;
}

async function fetchAdminAuditList(adminClient: CookieClient, search: string) {
  const response = await adminClient.request(
    `/api/admin/payments/audit?search=${encodeURIComponent(search)}&page=1&pageSize=20`
  );
  assertStatus(response, 200, "admin payment audit list");
  assert.equal(Boolean(response.body?.success), true, "admin payment audit list: success missing");
  return response.body?.data ?? null;
}

async function fetchSellerOrderDetail(
  sellerClient: CookieClient,
  storeId: number,
  suborderId: number
) {
  const response = await sellerClient.request(`/api/seller/stores/${storeId}/suborders/${suborderId}`);
  assertStatus(response, 200, "seller suborder detail");
  assert.equal(Boolean(response.body?.success), true, "seller suborder detail: success missing");
  return response.body?.data ?? null;
}

function stripCheckoutPreviewMeta(preview: any) {
  if (!preview || typeof preview !== "object") return preview;
  const cloned = JSON.parse(JSON.stringify(preview));
  const groups = Array.isArray(cloned?.groups) ? cloned.groups : [];
  groups.forEach((group: any) => {
    if (group && typeof group === "object") {
      delete group.paymentAvailabilityMeta;
      delete group.paymentProfileStatusMeta;
    }
  });
  return cloned;
}

function getSellerStatusLabel(detail: any) {
  return String(
    detail?.contract?.statusSummary?.label ||
      detail?.readModel?.primaryStatus?.label ||
      detail?.fulfillmentStatusMeta?.label ||
      detail?.fulfillmentStatus ||
      "-"
  );
}

function getSellerPaymentLabel(detail: any) {
  return String(
    detail?.contract?.paymentStatusMeta?.label ||
      detail?.readModel?.paymentState?.label ||
      detail?.paymentStatusMeta?.label ||
      detail?.paymentStatus ||
      "-"
  );
}

function resolveInvalidCheckoutMessage(reason: string) {
  const code = String(reason || "").trim().toUpperCase();
  if (code === "PRODUCT_NOT_PUBLIC") {
    return "This item is no longer publicly purchasable because the product or its store is currently gated.";
  }
  if (code === "PRODUCT_OUT_OF_STOCK") {
    return "This item is out of stock and cannot be checked out.";
  }
  if (code === "PRODUCT_STORE_UNMAPPED") {
    return "This item is missing store binding and is blocked from checkout.";
  }
  return "Stock changed before checkout. Update the cart quantity and try again.";
}

async function gotoRoute(page: any, pathname: string) {
  await page.goto(`${clientBase}${pathname}`, { waitUntil: "load", timeout: 30000 });
}

async function waitForUrl(page: any, matcher: RegExp, label: string) {
  await page.waitForURL(matcher, { timeout: 15000 });
  assert.ok(matcher.test(page.url()), `${label}: unexpected url ${page.url()}`);
}

async function waitForBodyText(page: any, expected: string, timeoutMs = 15000) {
  const locator = page.locator("body");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await locator.textContent();
    if (String(text || "").includes(expected)) return;
    await delay(250);
  }
  const text = await locator.textContent();
  throw new Error(`Expected page to include "${expected}", received "${text}"`);
}

async function waitForTestIdText(page: any, testId: string, expected: string, timeoutMs = 15000) {
  const locator = page.getByTestId(testId);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const target = locator.first();
    const isVisible = await target.isVisible().catch(() => false);
    if (isVisible) {
      const text = await target.textContent();
      if (String(text || "").includes(expected)) return;
    }
    await delay(250);
  }
  const text = await locator
    .evaluateAll((nodes: any[]) => nodes.map((node) => node.textContent || "").join(" | "))
    .catch(() => "");
  const bodyText = String((await page.locator("body").textContent().catch(() => "")) || "")
    .replace(/\s+/g, " ")
    .slice(0, 600);
    throw new Error(
      `Expected [${testId}] to include "${expected}", received "${text}" at ${page.url()} body="${bodyText}"`
    );
  }

async function expectTestIdAttribute(
  page: any,
  testId: string,
  attribute: string,
  expected: string,
  timeoutMs = 15000
) {
  const locator = page.getByTestId(testId).first();
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const isVisible = await locator.isVisible().catch(() => false);
    if (isVisible) {
      const value = await locator.getAttribute(attribute);
      if (String(value || "") === expected) return;
    }
    await delay(250);
  }
  const value = await locator
    .evaluateAll((nodes: any[], attr: string) =>
      nodes.map((node) => node.getAttribute?.(attr) || "").join(" | "),
    attribute)
    .catch(() => "");
  const bodyText = String((await page.locator("body").textContent().catch(() => "")) || "")
    .replace(/\s+/g, " ")
    .slice(0, 600);
  throw new Error(
    `Expected [${testId}] attribute ${attribute}="${expected}", received "${value}" at ${page.url()} body="${bodyText}"`
  );
}

async function createAuthedContext(browser: any, client: CookieClient) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("authSessionHint", "true");
    } catch {
      // ignore localStorage bootstrap issues in smoke setup
    }
  });
  const cookieHeader = String(client.getCookieHeader() || "").trim();
  const [cookiePair] = cookieHeader.split(";");
  const separatorIndex = cookiePair.indexOf("=");
  assert.ok(separatorIndex > 0, `Missing auth cookie header: ${cookieHeader}`);
  const name = cookiePair.slice(0, separatorIndex).trim();
  const value = cookiePair.slice(separatorIndex + 1).trim();
  await context.addCookies([
    {
      name,
      value,
      url: clientBase,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return context;
}

async function runScenario(browser: any) {
  log("creating fixtures");
  const adminUser = await createFixtureUser("admin", "super_admin");
  const checkoutSellerUser = await createFixtureUser("checkout-seller", "seller");
  const orderSellerUser = await createFixtureUser("order-seller", "seller");
  const buyerUser = await createFixtureUser("buyer");

  const checkoutStore = await createFixtureStore(checkoutSellerUser.id, "checkout-store");
  const orderStore = await createFixtureStore(orderSellerUser.id, "order-store");
  const checkoutProfile = await createFixturePaymentProfile(checkoutStore.id);
  await createFixturePaymentProfile(orderStore.id);
  const checkoutProduct = await createFixtureProduct({
    ownerUserId: checkoutSellerUser.id,
    storeId: checkoutStore.id,
    label: "checkout-product",
  });
  const orderProduct = await createFixtureProduct({
    ownerUserId: orderSellerUser.id,
    storeId: orderStore.id,
    label: "order-product",
  });

  log("authenticating API clients");
  const adminClient = new CookieClient();
  const orderSellerClient = new CookieClient();
  const buyerClient = new CookieClient();
  await loginAdmin(adminClient, adminUser.email, adminUser.password);
  await login(
    orderSellerClient,
    orderSellerUser.email,
    orderSellerUser.password,
    "order seller login"
  );
  await login(buyerClient, buyerUser.email, buyerUser.password, "buyer login");

  log("running client checkout browser assertions");
  const buyerContext = await createAuthedContext(browser, buyerClient);
  const buyerPage = await buyerContext.newPage();
  try {
    let checkoutPreviewMode: "backend" | "fallback" = "backend";
    await buyerPage.route("**/api/checkout/preview", async (route: any) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const preview = await fetchCheckoutPreview(buyerClient);
      const responseBody = {
        success: true,
        data: checkoutPreviewMode === "fallback" ? stripCheckoutPreviewMeta(preview) : preview,
      };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(responseBody),
      });
    });
    await gotoRoute(buyerPage, `/product/${encodeURIComponent(checkoutProduct.slug)}`);
    await waitForBodyText(buyerPage, checkoutProduct.name);
    const authMeStatus = await buyerPage.evaluate(async () => {
      const response = await fetch("/api/auth/me", { credentials: "include" });
      return response.status;
      });
      assert.equal(authMeStatus, 200, `buyer auth probe failed with status ${authMeStatus}`);
      const cartStatus = await buyerPage.evaluate(async () => {
        const response = await fetch("/api/cart", { credentials: "include" });
        return response.status;
      });
      assert.equal(cartStatus, 200, `buyer cart probe failed with status ${cartStatus}`);
      await delay(750);
      await buyerPage.getByRole("button", { name: "Add to Cart" }).click();
      await addProductToCart(buyerClient, buyerUser.id, checkoutProduct.id);
      await gotoRoute(buyerPage, "/cart");
      await waitForBodyText(buyerPage, checkoutProduct.name);
      await buyerPage.getByRole("link", { name: "Proceed to Checkout" }).click();
      await waitForUrl(buyerPage, /\/checkout$/, "open checkout");
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);

    const activePreview = await fetchCheckoutPreview(buyerClient);
    const activeGroup =
      (Array.isArray(activePreview?.groups) ? activePreview.groups : []).find(
        (group: any) => Number(group?.storeId) === checkoutStore.id
      ) || null;
    assert.ok(activeGroup, "active checkout preview group missing");
    const activePaymentLabel = String(
      activeGroup?.paymentAvailabilityMeta?.label ||
        (activeGroup?.paymentAvailable ? "Payment Ready" : "Payment Blocked")
    );
    const activePaymentSource = activeGroup?.paymentAvailabilityMeta?.label ? "meta" : "fallback";
    const activeProfileLabel = String(
      activeGroup?.paymentProfileStatusMeta?.label ||
        String(activeGroup?.paymentProfileStatus || "").trim() ||
        "Unavailable"
    );
      const activeProfileSource = activeGroup?.paymentProfileStatusMeta?.label ? "meta" : "fallback";
      assert.ok(activePaymentLabel, "active checkout preview payment label missing");
      assert.ok(activeProfileLabel, "active checkout preview profile label missing");
      await buyerPage.reload({ waitUntil: "load", timeout: 30000 });
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
    await waitForBodyText(buyerPage, "Checkout Summary");
    await waitForBodyText(buyerPage, checkoutProduct.name);
    await waitForTestIdText(
      buyerPage,
      `checkout-preview-group-payment-availability-${checkoutStore.id}`,
      activePaymentLabel
    );
    await expectTestIdAttribute(
      buyerPage,
      `checkout-preview-group-payment-availability-${checkoutStore.id}`,
      "data-checkout-source",
      activePaymentSource
    );
    await waitForTestIdText(
      buyerPage,
      `checkout-preview-group-payment-profile-${checkoutStore.id}`,
      activeProfileLabel
    );
    await expectTestIdAttribute(
      buyerPage,
      `checkout-preview-group-payment-profile-${checkoutStore.id}`,
        "data-checkout-source",
        activeProfileSource
      );

      checkoutPreviewMode = "fallback";
      await buyerPage.goto(`${clientBase}/checkout`, { waitUntil: "load", timeout: 30000 });
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
      await waitForBodyText(buyerPage, "Checkout Summary");
      await waitForTestIdText(
        buyerPage,
        `checkout-preview-group-payment-availability-${checkoutStore.id}`,
        activeGroup?.paymentAvailable ? "Payment Ready" : "Payment Blocked"
      );
      await expectTestIdAttribute(
        buyerPage,
        `checkout-preview-group-payment-availability-${checkoutStore.id}`,
        "data-checkout-source",
        "fallback"
      );
      await waitForTestIdText(
        buyerPage,
        `checkout-preview-group-payment-profile-${checkoutStore.id}`,
        String(activeGroup?.paymentProfileStatus || "").trim() || "Unavailable"
      );
      await expectTestIdAttribute(
        buyerPage,
        `checkout-preview-group-payment-profile-${checkoutStore.id}`,
        "data-checkout-source",
        "fallback"
      );

      checkoutPreviewMode = "backend";

      await StorePaymentProfile.update(
        { isActive: false, activatedAt: null } as any,
        { where: { id: checkoutProfile.id } as any }
      );

      const blockedPreview = await fetchCheckoutPreview(buyerClient);
      const invalidItems = Array.isArray(blockedPreview?.invalidItems) ? blockedPreview.invalidItems : [];
      const blockedItem =
        invalidItems.find((item: any) => Number(item?.productId) === checkoutProduct.id) || null;
      assert.ok(blockedItem, "blocked checkout preview item missing");
      const blockedMessage = resolveInvalidCheckoutMessage(String(blockedItem?.reason || ""));

      await gotoRoute(buyerPage, "/checkout");
      await waitForBodyText(buyerPage, "Place an Order");
      await waitForBodyText(buyerPage, checkoutProduct.name);
      await waitForTestIdText(
        buyerPage,
        `checkout-invalid-item-message-${checkoutProduct.id}`,
        blockedMessage
      );
    await expectTestIdAttribute(
      buyerPage,
      `checkout-invalid-item-${checkoutProduct.id}`,
      "data-checkout-reason",
      String(blockedItem?.reason || "")
    );
    await waitForTestIdText(
      buyerPage,
      "checkout-submit-blocker-message",
      "Resolve the blocked store groups or invalid items above before placing this order."
    );
    const submitButton = buyerPage.getByTestId("checkout-submit-cta");
    await submitButton.waitFor({ state: "visible", timeout: 15000 });
    const started = Date.now();
    while (Date.now() - started < 15000) {
      if (await submitButton.isDisabled().catch(() => false)) break;
      await delay(250);
    }
    assert.equal(
      await submitButton.isDisabled().catch(() => false),
      true,
      "checkout submit CTA should stay disabled"
    );
  } finally {
    await buyerPage.close().catch(() => null);
    await buyerContext.close().catch(() => null);
  }

  log("creating approved order through backend for admin and seller surfaces");
  const approvedScenario = await createCheckoutOrder({
    customerClient: buyerClient,
    buyerUserId: buyerUser.id,
    productId: orderProduct.id,
    label: "approved",
  });
  await submitProof(buyerClient, approvedScenario.paymentId, "approved");
  await reviewPayment(
    orderSellerClient,
    orderStore.id,
    approvedScenario.paymentId,
    "APPROVE",
    "approved"
  );

  const adminAuditList = await fetchAdminAuditList(adminClient, approvedScenario.invoiceNo);
  const adminAuditEntry =
    (Array.isArray(adminAuditList?.items) ? adminAuditList.items : []).find(
      (item: any) => Number(item?.orderId) === approvedScenario.orderId
    ) || null;
  assert.ok(adminAuditEntry, "admin audit entry missing");
  const expectedAdminOrderLabel = String(
    adminAuditEntry?.orderStatusMeta?.label || adminAuditEntry?.orderStatus || "-"
  );
  const expectedAdminPaymentLabel = String(
    adminAuditEntry?.paymentStatusMeta?.label || adminAuditEntry?.paymentStatus || "-"
  );

  const sellerDetail = await fetchSellerOrderDetail(
    orderSellerClient,
    orderStore.id,
    approvedScenario.suborderId
  );
  const expectedSellerStatusLabel = getSellerStatusLabel(sellerDetail);
  const expectedSellerPaymentLabel = getSellerPaymentLabel(sellerDetail);
  const expectedSuborderNumber = String(sellerDetail?.suborderNumber || approvedScenario.suborderId);

  log("running admin payment audit browser assertions");
  const adminContext = await createAuthedContext(browser, adminClient);
  const adminPage = await adminContext.newPage();
  try {
    await gotoRoute(
      adminPage,
      `/admin/online-store/payment-audit?search=${encodeURIComponent(approvedScenario.invoiceNo)}`
    );
    const row = adminPage.locator("tbody tr").filter({ hasText: adminAuditEntry.orderNumber }).first();
    await row.waitFor({ state: "visible", timeout: 15000 });
    const rowText = String((await row.textContent()) || "");
    assert.ok(
      rowText.includes(`Order ${expectedAdminOrderLabel}`),
      `admin audit row missing order label: ${rowText}`
    );
    assert.ok(
      rowText.includes(`Parent ${expectedAdminPaymentLabel}`),
      `admin audit row missing payment label: ${rowText}`
    );
  } finally {
    await adminPage.close().catch(() => null);
    await adminContext.close().catch(() => null);
  }

  log("running seller order browser assertions");
  const sellerContext = await createAuthedContext(browser, orderSellerClient);
  const sellerPage = await sellerContext.newPage();
  try {
    await gotoRoute(
      sellerPage,
      `/seller/stores/${encodeURIComponent(orderStore.slug)}/orders/${approvedScenario.suborderId}`
    );
    await waitForBodyText(sellerPage, expectedSuborderNumber);
    await waitForBodyText(sellerPage, `Store split ${expectedSellerPaymentLabel}`);
    await waitForBodyText(sellerPage, `Seller ${expectedSellerStatusLabel}`);
  } finally {
    await sellerPage.close().catch(() => null);
    await sellerContext.close().catch(() => null);
  }

  console.log("[e2e-truth] OK");
}

async function cleanupFixtures() {
  for (const userId of createdUserIds) {
    await resetCartForUser(userId).catch(() => null);
  }

  if (createdOrderIds.length > 0) {
    const suborders = await Suborder.findAll({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      attributes: ["id"],
    }).catch(() => []);
    const suborderIds = (Array.isArray(suborders) ? suborders : [])
      .map((row: any) => toNumber(row?.getDataValue?.("id") ?? row?.id, 0))
      .filter((id: number) => id > 0);

    const payments = suborderIds.length
      ? await Payment.findAll({
          where: { suborderId: { [Op.in]: suborderIds } } as any,
          attributes: ["id"],
        }).catch(() => [])
      : [];
    const paymentIds = (Array.isArray(payments) ? payments : [])
      .map((row: any) => toNumber(row?.getDataValue?.("id") ?? row?.id, 0))
      .filter((id: number) => id > 0);

    if (paymentIds.length > 0) {
      await PaymentStatusLog.destroy({
        where: { paymentId: { [Op.in]: paymentIds } } as any,
        force: true,
      }).catch(() => null);
      await PaymentProof.destroy({
        where: { paymentId: { [Op.in]: paymentIds } } as any,
        force: true,
      }).catch(() => null);
      await Payment.destroy({ where: { id: { [Op.in]: paymentIds } } as any, force: true }).catch(
        () => null
      );
    }

    if (suborderIds.length > 0) {
      await SuborderItem.destroy({
        where: { suborderId: { [Op.in]: suborderIds } } as any,
        force: true,
      }).catch(() => null);
      await Suborder.destroy({ where: { id: { [Op.in]: suborderIds } } as any, force: true }).catch(
        () => null
      );
    }

    await OrderItem.destroy({ where: { orderId: { [Op.in]: createdOrderIds } } as any, force: true }).catch(
      () => null
    );
    await Order.destroy({ where: { id: { [Op.in]: createdOrderIds } } as any, force: true }).catch(
      () => null
    );
  }

  if (createdProductIds.length > 0) {
    await Product.destroy({ where: { id: { [Op.in]: createdProductIds } } as any, force: true }).catch(
      () => null
    );
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
    await Store.destroy({ where: { id: { [Op.in]: createdStoreIds } } as any, force: true }).catch(
      () => null
    );
  }

  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: { [Op.in]: createdUserIds } } as any, force: true }).catch(
      () => null
    );
  }
}

async function main() {
  let clientProc: any = null;
  let backendServer: any = null;
  let browser: any = null;

  try {
    await ensurePortAvailable(API_PORT);
    clientPort = await getFreePort();
    clientOrigin = `http://${APP_HOST}:${clientPort}`;
    clientBase = clientOrigin;
    const smokeCorsOrigins = [
      clientOrigin,
      `http://localhost:${clientPort}`,
      `http://${APP_HOST}:${API_PORT}`,
      `http://localhost:${API_PORT}`,
    ].join(",");

    await withEnv(
      {
        COOKIE_SECURE: "false",
        CLIENT_URL: clientOrigin,
        CORS_ORIGIN: smokeCorsOrigins,
        NODE_ENV: "development",
      },
      async () => {
        await ensureServerModules();
        await sequelize.authenticate();
        backendServer = app.listen(API_PORT, APP_HOST);
        await once(backendServer, "listening");

        clientProc = spawn(
          "pnpm",
          ["-F", "client", "dev", "--host", APP_HOST, "--port", String(clientPort), "--strictPort"],
          { stdio: "inherit", shell: true }
        );

        const apiReady = await withTimeout(
          () => waitFor(`http://${APP_HOST}:${API_PORT}/api/health`, 30000),
          35000,
          "backend app"
        );
        if (!apiReady) throw new Error("Backend app did not respond on /api/health.");

        const clientReady = await withTimeout(() => waitFor(clientBase, 60000), 70000, "client app");
        if (!clientReady) throw new Error("Client dev server did not respond.");

        const { chromium } = await ensurePlaywright();
        browser = await chromium.launch({ headless: true });
        await runScenario(browser);
      }
    );
  } finally {
    if (browser) await browser.close().catch(() => null);
    if (clientProc) await stopProcessTree(clientProc);
    if (backendServer) {
      backendServer.close();
      await once(backendServer, "close").catch(() => null);
    }
    await cleanupFixtures().catch((error) => {
      console.error("[e2e-truth] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize?.close().catch(() => null);
  }
}

main().catch((error) => {
  console.error("[e2e-truth] FAIL", error);
  process.exitCode = 1;
});
