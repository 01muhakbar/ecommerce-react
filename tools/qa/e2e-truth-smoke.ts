import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { Op, QueryTypes } from "sequelize";
import { config as loadEnv } from "dotenv";
import {
  getSplitOperationalPayment,
  getSplitOperationalStatusSummary,
} from "../../client/src/utils/splitOperationalTruth.ts";

const APP_HOST = "127.0.0.1";
const API_PORT = Number(
  process.env.E2E_TRUTH_API_PORT || process.env.SHIPMENT_QA_API_PORT || 3001
);
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

type VariantSelection = {
  attributeId: number;
  attributeName: string;
  valueId: number | string | null;
  value: string;
};

type VariantRecord = {
  combination: string;
  combinationKey: string;
  selections: VariantSelection[];
  price: number;
  salePrice: number;
  quantity: number;
  sku: string;
  barcode: string;
  image: string;
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
const createdAttributeIds: number[] = [];
const createdAttributeValueIds: number[] = [];

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

const buildVariantCombinationKey = (selections: VariantSelection[]) =>
  selections
    .map((entry) =>
      `${entry.attributeId}:${String(entry.valueId ?? entry.value).trim().toLowerCase()}`
    )
    .join("|");

async function createFixtureAttributeValues(label: string) {
  const [attributeResult, attributeMeta] = await sequelize.query(
    `
      INSERT INTO attributes
        (name, display_name, type, published, scope, created_by_role, status, created_at, updated_at)
      VALUES
        (?, ?, 'dropdown', 1, 'global', 'admin', 'active', NOW(), NOW())
    `,
    {
      replacements: [`${RUN_ID}-${label}-color`, "Color"],
    }
  );
  let attributeId = Number((attributeMeta as any)?.insertId || (attributeResult as any)?.insertId || 0);
  if (!attributeId) {
    const rows = await sequelize.query<{ id: number }>(
      "SELECT id FROM attributes WHERE name = ? LIMIT 1",
      {
        replacements: [`${RUN_ID}-${label}-color`],
        type: QueryTypes.SELECT,
      }
    );
    attributeId = Number(rows[0]?.id || 0);
  }
  assert.ok(attributeId > 0, "failed to create checkout attribute fixture");
  createdAttributeIds.push(attributeId);

  const values: Array<{ id: number; value: string }> = [];
  for (const value of ["Blue", "Green"]) {
    const [valueResult, valueMeta] = await sequelize.query(
      `
        INSERT INTO attribute_values
          (attribute_id, value, status, created_at, updated_at)
        VALUES
          (?, ?, 'active', NOW(), NOW())
      `,
      {
        replacements: [attributeId, value],
      }
    );
    let valueId = Number((valueMeta as any)?.insertId || (valueResult as any)?.insertId || 0);
    if (!valueId) {
      const rows = await sequelize.query<{ id: number }>(
        "SELECT id FROM attribute_values WHERE attribute_id = ? AND value = ? LIMIT 1",
        {
          replacements: [attributeId, value],
          type: QueryTypes.SELECT,
        }
      );
      valueId = Number(rows[0]?.id || 0);
    }
    assert.ok(valueId > 0, "failed to create checkout attribute value fixture");
    createdAttributeValueIds.push(valueId);
    values.push({ id: valueId, value });
  }

  return {
    attributeId,
    attributeName: "Color",
    blueValueId: values[0].id,
    greenValueId: values[1].id,
  };
}

async function createFixtureVariantProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
  name?: string;
}) {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const attribute = await createFixtureAttributeValues(input.label);
  const blueSelections: VariantSelection[] = [
    {
      attributeId: attribute.attributeId,
      attributeName: attribute.attributeName,
      valueId: attribute.blueValueId,
      value: "Blue",
    },
  ];
  const greenSelections: VariantSelection[] = [
    {
      attributeId: attribute.attributeId,
      attributeName: attribute.attributeName,
      valueId: attribute.greenValueId,
      value: "Green",
    },
  ];
  const variants: VariantRecord[] = [
    {
      combination: "Blue",
      combinationKey: buildVariantCombinationKey(blueSelections),
      selections: blueSelections,
      price: 30000,
      salePrice: 25000,
      quantity: 12,
      sku: `${slug.toUpperCase()}-BLUE`,
      barcode: `${slug.toUpperCase()}-BLUE`,
      image: "/uploads/products/demo.svg",
    },
    {
      combination: "Green",
      combinationKey: buildVariantCombinationKey(greenSelections),
      selections: greenSelections,
      price: 42000,
      salePrice: 30000,
      quantity: 12,
      sku: `${slug.toUpperCase()}-GREEN`,
      barcode: `${slug.toUpperCase()}-GREEN`,
      image: "/uploads/products/demo.svg",
    },
  ];

  const product = await Product.create({
    name: input.name || slug,
    slug,
    sku: slug.toUpperCase(),
    price: 45000,
    salePrice: 40000,
    stock: 30,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
    promoImagePath: "/uploads/products/demo.svg",
    imagePaths: ["/uploads/products/demo.svg", "/uploads/products/demo.svg"],
    variations: {
      hasVariants: true,
      variants,
    },
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug, name: String(product.getDataValue("name") || slug), variants };
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
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await resetCartForUser(buyerUserId);
    const response = await customerClient.request("/api/cart/add", {
      method: "POST",
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    const responseText = String(response.text || "");
    if (response.status === 500 && responseText.includes("Deadlock") && attempt < 2) {
      await delay(500);
      continue;
    }
    assertStatus(response, 200, "add product to cart");
    return;
  }
}

async function addVariantProductToCart(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  variant: VariantRecord;
  quantity: number;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await resetCartForUser(input.buyerUserId);
    const response = await input.customerClient.request("/api/cart/add", {
      method: "POST",
      body: JSON.stringify({
        productId: input.productId,
        quantity: input.quantity,
        variantKey: input.variant.combinationKey,
        variantSelections: input.variant.selections,
      }),
    });
    const responseText = String(response.text || "");
    if (response.status === 500 && responseText.includes("Deadlock") && attempt < 2) {
      await delay(500);
      continue;
    }
    assertStatus(response, 200, "add variant product to cart");
    return;
  }
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

function buildCheckoutPreviewWithCanonicalPriceDrift(preview: any) {
  if (!preview || typeof preview !== "object") return preview;
  const cloned = JSON.parse(JSON.stringify(preview));
  const group = Array.isArray(cloned?.groups) ? cloned.groups[0] : null;
  const item = Array.isArray(group?.items) ? group.items[0] : null;
  if (!group || !item) return cloned;
  const qty = Math.max(1, Number(item.qty || item.quantity || 1));
  const delta = 1000;
  item.price = Number(item.price || 0) + delta;
  item.lineTotal = Number(item.lineTotal || 0) + delta * qty;
  group.subtotalAmount = Number(group.subtotalAmount || 0) + delta * qty;
  group.totalAmount = Number(group.totalAmount || 0) + delta * qty;
  if (cloned.summary && typeof cloned.summary === "object") {
    cloned.summary.subtotalAmount = Number(cloned.summary.subtotalAmount || 0) + delta * qty;
    cloned.summary.grandTotal = Number(cloned.summary.grandTotal || 0) + delta * qty;
  }
  return cloned;
}

function getSellerStatusLabel(detail: any) {
  return String(
    getSplitOperationalStatusSummary(detail)?.label ||
      detail?.contract?.statusSummary?.label ||
      detail?.readModel?.primaryStatus?.label ||
      detail?.fulfillmentStatusMeta?.label ||
      detail?.fulfillmentStatus ||
      "-"
  );
}

function getSellerPaymentLabel(detail: any) {
  return String(
    getSplitOperationalPayment(detail)?.statusMeta?.label ||
      detail?.contract?.paymentStatusMeta?.label ||
      detail?.readModel?.paymentState?.label ||
      detail?.paymentStatusMeta?.label ||
      detail?.paymentStatus ||
      "-"
  );
}

function resolveInvalidCheckoutMessage(reason: string) {
  const code = String(reason || "").trim().toUpperCase();
  if (code === "PRODUCT_VARIANT_REQUIRED") {
    return "Choose a variant before continuing.";
  }
  if (code === "PRODUCT_VARIANT_MISSING") {
    return "This cart line has lost its variant selection. Remove it and choose the variant again.";
  }
  if (code === "VARIANT_NOT_AVAILABLE") {
    return "This variant is no longer available. Remove it or choose another variant.";
  }
  if (code === "PRODUCT_NOT_PUBLIC") {
    return "This item is no longer publicly available for checkout.";
  }
  if (code === "PRODUCT_OUT_OF_STOCK") {
    return "This product is currently out of stock.";
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

async function waitForAllTexts(page: any, expectedTexts: string[], timeoutMs = 15000) {
  for (const expected of expectedTexts) {
    await waitForBodyText(page, expected, timeoutMs);
  }
}

async function expectBodyTextAbsent(page: any, unexpected: string | RegExp) {
  const text = await page.locator("body").textContent();
  const bodyText = String(text || "");
  const matches =
    unexpected instanceof RegExp ? unexpected.test(bodyText) : bodyText.includes(unexpected);
  assert.equal(
    matches,
    false,
    `Expected page not to include "${unexpected}"`
  );
}

async function assertOrganicBananaCheckoutReady(page: any, quantity: number, totalText: string) {
  await waitForBodyText(page, "Checkout Summary");
  await waitForBodyText(page, "Order Summary by Store");
  await waitForBodyText(page, "Organic Banana");
  await waitForBodyText(page, "Variant: Blue");
  await waitForBodyText(page, totalText);
  await waitForTestIdText(page, "checkout-preview-groups-section", "Organic Banana");
  await waitForTestIdText(page, "checkout-preview-groups-section", "Variant: Blue");
  await waitForTestIdText(
    page,
    "checkout-preview-groups-section",
    `Qty ${quantity} x Rp 25.000`
  );
  await waitForTestIdText(page, "checkout-preview-groups-section", totalText);
  await expectBodyTextAbsent(page, /Backend preview is still catching up/i);
  await expectBodyTextAbsent(page, /Latest checkout snapshot is refreshing/i);
  await expectBodyTextAbsent(page, /Checkout preview must finish syncing/i);
  await expectBodyTextAbsent(page, /Checkout preview is refreshing/i);
  await expectBodyTextAbsent(page, /Wait for the checkout preview/i);
  await expectBodyTextAbsent(page, /Order placement is paused/i);
  await expectBodyTextAbsent(page, /finish syncing before applying coupons/i);
  assert.equal(
    await page.getByTestId("checkout-coupon-apply-button").isDisabled().catch(() => true),
    false,
    `coupon apply should not be sync-blocked for Organic Banana qty ${quantity}`
  );
  assert.equal(
    await page.getByTestId("checkout-submit-cta").isDisabled().catch(() => true),
    false,
    `checkout submit CTA should not be sync-blocked for Organic Banana qty ${quantity}`
  );
}

async function readCheckoutPreviewDebugSnapshot(page: any) {
  const raw = await page
    .getByTestId("checkout-preview-debug-panel")
    .locator("pre")
    .textContent()
    .catch(() => "");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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

async function fillCheckoutShippingForm(page: any, label: string) {
  const checkoutForm = page
    .locator("form")
    .filter({ has: page.getByTestId("checkout-submit-cta") })
    .first();
  await checkoutForm.getByPlaceholder("First Name").fill(label);
  await checkoutForm.getByPlaceholder("Last Name").fill("Checkout");
  await checkoutForm.getByPlaceholder("Email Address").fill(`${slugify(label)}@local.dev`);
  await checkoutForm.getByPlaceholder("Phone Number").fill("081234567890");
  await checkoutForm.locator("select").nth(0).selectOption({ label: "DKI Jakarta" });
  await checkoutForm.locator("select").nth(1).selectOption({ label: "Kota Jakarta Selatan" });
  await checkoutForm.locator("select").nth(2).selectOption({ label: "Kebayoran Baru" });
  await checkoutForm.locator("input").nth(4).fill("12190");
  await checkoutForm.locator("input").nth(5).fill(`${label} Street`);
  await checkoutForm.locator("input").nth(6).fill("12");
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
  const checkoutSubmitBuyerUser = await createFixtureUser("checkout-submit-buyer");
  const doubleSubmitBuyerUser = await createFixtureUser("double-submit-buyer");

  const checkoutStore = await createFixtureStore(checkoutSellerUser.id, "checkout-store");
  const orderStore = await createFixtureStore(orderSellerUser.id, "order-store");
  const checkoutProfile = await createFixturePaymentProfile(checkoutStore.id);
  await createFixturePaymentProfile(orderStore.id);
  const checkoutProduct = await createFixtureProduct({
    ownerUserId: checkoutSellerUser.id,
    storeId: checkoutStore.id,
    label: "checkout-product",
  });
  const variantProduct = await createFixtureVariantProduct({
    ownerUserId: checkoutSellerUser.id,
    storeId: checkoutStore.id,
    label: "checkout-variant-product",
  });
  const checkoutReadyVariantProduct = await createFixtureVariantProduct({
    ownerUserId: checkoutSellerUser.id,
    storeId: checkoutStore.id,
    label: "checkout-ready-variant-product",
    name: "Organic Banana",
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
  const checkoutSubmitClient = new CookieClient();
  const doubleSubmitClient = new CookieClient();
  await loginAdmin(adminClient, adminUser.email, adminUser.password);
  await login(
    orderSellerClient,
    orderSellerUser.email,
    orderSellerUser.password,
    "order seller login"
  );
  await login(buyerClient, buyerUser.email, buyerUser.password, "buyer login");
  await login(
    checkoutSubmitClient,
    checkoutSubmitBuyerUser.email,
    checkoutSubmitBuyerUser.password,
    "checkout submit buyer login"
  );
  await login(
    doubleSubmitClient,
    doubleSubmitBuyerUser.email,
    doubleSubmitBuyerUser.password,
    "double submit buyer login"
  );

  log("running guest login recovery browser assertions");
  const guestVariantContext = await browser.newContext();
  await guestVariantContext.addInitScript((seedItem: any) => {
    try {
      window.localStorage.removeItem("authSessionHint");
      window.localStorage.setItem("guest_cart_v1", JSON.stringify({ items: [seedItem] }));
    } catch {
      // ignore guest cart bootstrap issues in smoke setup
    }
  }, {
    productId: variantProduct.id,
    qty: 1,
    lineId: `${variantProduct.id}:${variantProduct.variants[0].combinationKey}`,
    name: variantProduct.name,
    price: variantProduct.variants[0].salePrice,
    imageUrl: variantProduct.variants[0].image,
    variantKey: variantProduct.variants[0].combinationKey,
    variantLabel: variantProduct.variants[0].combination,
    variantSelections: variantProduct.variants[0].selections,
    variantSku: variantProduct.variants[0].sku,
    variantBarcode: variantProduct.variants[0].barcode,
    variantPrice: variantProduct.variants[0].price,
    variantSalePrice: variantProduct.variants[0].salePrice,
    variantImage: variantProduct.variants[0].image,
    stock: variantProduct.variants[0].quantity,
  });
  const guestVariantPage = await guestVariantContext.newPage();
  try {
    let previewMutationApplied = false;
    await guestVariantPage.route("**/api/checkout/preview", async (route: any) => {
      if (route.request().method() !== "POST" || previewMutationApplied) {
        await route.continue();
        return;
      }
      previewMutationApplied = true;
      const current = await Product.findByPk(variantProduct.id);
      const currentVariations =
        (typeof current?.getDataValue === "function" ? current.getDataValue("variations") : null) ||
        {};
      const nextVariants = (Array.isArray((currentVariations as any)?.variants)
        ? (currentVariations as any).variants
        : []
      ).filter(
        (entry: any) =>
          String(entry?.combinationKey || "").trim().toLowerCase() !==
          String(variantProduct.variants[0].combinationKey || "").trim().toLowerCase()
      );
      await Product.update(
        {
          variations: {
            ...(currentVariations || {}),
            hasVariants: true,
            variants: nextVariants,
          },
        } as any,
        { where: { id: variantProduct.id } as any }
      );
      await route.continue();
    });

    await gotoRoute(guestVariantPage, "/checkout");
    await waitForBodyText(guestVariantPage, variantProduct.name);
    await waitForBodyText(guestVariantPage, "Variant: Blue");
    await guestVariantPage.getByPlaceholder("First Name").fill("Guest");
    await guestVariantPage.getByPlaceholder("Last Name").fill("Recovery");
    await guestVariantPage.getByPlaceholder("Email Address").fill("guest-recovery@local.dev");
    await guestVariantPage.getByPlaceholder("Phone Number").fill("081234567890");
    await guestVariantPage.locator("select").nth(0).selectOption({ label: "DKI Jakarta" });
    await guestVariantPage.locator("select").nth(1).selectOption({ label: "Kota Jakarta Selatan" });
    await guestVariantPage.locator("select").nth(2).selectOption({ label: "Kebayoran Baru" });
    await guestVariantPage.locator("input").nth(4).fill("12190");
    await guestVariantPage.locator("input").nth(5).fill("Guest Recovery Street");
    await guestVariantPage.locator("input").nth(6).fill("12");
    await guestVariantPage.getByTestId("checkout-submit-cta").click();
    await waitForUrl(guestVariantPage, /\/auth\/login$/, "guest checkout login redirect");
    await waitForBodyText(guestVariantPage, "Sign in to continue checkout.");
    const loginState = await guestVariantPage.evaluate(() => (window.history.state as any)?.usr || null);
    assert.equal(
      String(loginState?.from || "/checkout"),
      "/checkout",
      "login redirect should preserve checkout return path"
    );
  } finally {
    await guestVariantPage.close().catch(() => null);
    await guestVariantContext.close().catch(() => null);
  }

  log("running client checkout browser assertions");
  const buyerContext = await createAuthedContext(browser, buyerClient);
  const buyerPage = await buyerContext.newPage();
  try {
    let checkoutPreviewMode: "backend" | "fallback" | "canonical-price-drift" = "backend";
    await buyerPage.route("**/api/checkout/preview", async (route: any) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      const preview = await fetchCheckoutPreview(buyerClient);
      const previewData =
        checkoutPreviewMode === "fallback"
          ? stripCheckoutPreviewMeta(preview)
          : checkoutPreviewMode === "canonical-price-drift"
            ? buildCheckoutPreviewWithCanonicalPriceDrift(preview)
            : preview;
      const responseBody = {
        success: true,
        data: previewData,
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
      const proceedToCheckout =
        buyerPage.getByRole("button", { name: "Proceed to Checkout" }).first();
      await proceedToCheckout.click();
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
    await waitForBodyText(buyerPage, "Order Summary by Store");
    await waitForBodyText(buyerPage, checkoutProduct.name);
    await expectBodyTextAbsent(buyerPage, /Backend preview is still catching up/i);
    await expectBodyTextAbsent(buyerPage, /Latest checkout snapshot is refreshing/i);
    await expectBodyTextAbsent(buyerPage, /Checkout preview must finish syncing/i);
    await expectBodyTextAbsent(buyerPage, /Checkout preview is refreshing/i);
    await expectBodyTextAbsent(buyerPage, /Order placement is paused/i);
    await expectBodyTextAbsent(buyerPage, /finish syncing before applying coupons/i);
    assert.equal(
      await buyerPage.getByTestId("checkout-submit-cta").isDisabled().catch(() => true),
      false,
      "checkout submit CTA should not be blocked when preview matches visible cart"
    );
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

      checkoutPreviewMode = "canonical-price-drift";
      await buyerPage.reload({ waitUntil: "load", timeout: 30000 });
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
      await waitForBodyText(buyerPage, "Order Summary by Store");
      await waitForTestIdText(buyerPage, "checkout-preview-groups-section", checkoutProduct.name);
      await expectBodyTextAbsent(buyerPage, /Backend preview is still catching up/i);
      await expectBodyTextAbsent(buyerPage, /Latest checkout snapshot is refreshing/i);
      await expectBodyTextAbsent(buyerPage, /Checkout preview must finish syncing/i);
      await expectBodyTextAbsent(buyerPage, /finish syncing before applying coupons/i);
      assert.equal(
        await buyerPage.getByTestId("checkout-coupon-apply-button").isDisabled().catch(() => true),
        false,
        "checkout coupon apply should stay enabled when backend canonical price differs from visible cart"
      );
      assert.equal(
        await buyerPage.getByTestId("checkout-submit-cta").isDisabled().catch(() => true),
        false,
        "checkout submit CTA should stay enabled when backend canonical price differs from visible cart"
      );
      checkoutPreviewMode = "backend";

      log("running checkout submit to payment and tracking browser assertions");
      await addVariantProductToCart({
        customerClient: checkoutSubmitClient,
        buyerUserId: checkoutSubmitBuyerUser.id,
        productId: checkoutReadyVariantProduct.id,
        variant: checkoutReadyVariantProduct.variants[0],
        quantity: 1,
      });
      const checkoutSubmitContext = await createAuthedContext(browser, checkoutSubmitClient);
      const checkoutSubmitPage = await checkoutSubmitContext.newPage();
      let checkoutCreateRequestCount = 0;
      let checkoutCreatePayload: any = null;
      try {
        checkoutSubmitPage.on("request", (request: any) => {
          if (
            request.method() !== "POST" ||
            !String(request.url()).includes("/api/checkout/create-multi-store")
          ) {
            return;
          }
          checkoutCreateRequestCount += 1;
          try {
            checkoutCreatePayload = JSON.parse(request.postData() || "{}");
          } catch {
            checkoutCreatePayload = null;
          }
        });

        await gotoRoute(checkoutSubmitPage, "/checkout");
        await checkoutSubmitPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
        await assertOrganicBananaCheckoutReady(checkoutSubmitPage, 1, "Rp 25.000");
        const submitDebug = await readCheckoutPreviewDebugSnapshot(checkoutSubmitPage);
        assert.equal(
          String(submitDebug?.mismatchReason || "MATCHED"),
          "MATCHED",
          "checkout submit flow: preview must match before submit"
        );
        assert.equal(
          String(submitDebug?.disabledReason || ""),
          "",
          "checkout submit flow: submit must not be blocked by preview sync"
        );

        await fillCheckoutShippingForm(checkoutSubmitPage, "Checkout Submit");
        await delay(250);
        const checkoutSubmitButton = checkoutSubmitPage.getByTestId("checkout-submit-cta");
        await checkoutSubmitButton.waitFor({ state: "visible", timeout: 15000 });
        assert.equal(
          await checkoutSubmitButton.isDisabled().catch(() => true),
          false,
          "checkout submit flow: CTA should be enabled after required fields"
        );

        const createResponsePromise = checkoutSubmitPage.waitForResponse(
          (response: any) =>
            response.request().method() === "POST" &&
            String(response.url()).includes("/api/checkout/create-multi-store"),
          { timeout: 30000 }
        );
        await checkoutSubmitButton.click();
        const createResponse = await createResponsePromise;
        assert.equal(createResponse.status(), 201, "checkout submit flow: create response status");
        const createBody = await createResponse.json();
        assert.equal(Boolean(createBody?.success), true, "checkout submit flow: create response success");
        const createdOrder = createBody?.data ?? null;
        const createdOrderId = toNumber(createdOrder?.orderId, 0);
        const createdInvoiceNo = String(createdOrder?.invoiceNo || createdOrder?.ref || "");
        const createdGroup = getSingleGroup(createdOrder, "checkout submit flow create response");
        const createdPayment = createdGroup?.payment ?? null;
        assert.ok(createdOrderId > 0, "checkout submit flow: orderId missing");
        assert.ok(createdInvoiceNo, "checkout submit flow: invoiceNo missing");
        assert.equal(
          String(createdOrder?.paymentStatus || ""),
          "UNPAID",
          "checkout submit flow: parent paymentStatus should start UNPAID"
        );
        assert.equal(
          String(createdPayment?.status || ""),
          "CREATED",
          "checkout submit flow: payment status should start CREATED"
        );
        assert.equal(
          toNumber(createdPayment?.amount, 0),
          25000,
          "checkout submit flow: payment amount should be canonical Organic Banana total"
        );
        assert.ok(
          String(createdPayment?.instructionText || createdGroup?.paymentInstruction || "").trim(),
          "checkout submit flow: payment instruction should be present"
        );
        assert.ok(
          String(createdPayment?.expiresAt || "").trim(),
          "checkout submit flow: payment deadline should be present"
        );
        assert.equal(
          checkoutCreateRequestCount,
          1,
          "checkout submit flow: browser should send one create request"
        );
        assert.ok(
          String(checkoutCreatePayload?.checkoutRequestKey || "").length >= 8,
          "checkout submit flow: checkoutRequestKey should be sent"
        );
        assert.equal(
          Number(checkoutCreatePayload?.shippingDetails?.postalCode || 0),
          12190,
          "checkout submit flow: shipping details should be sent"
        );

        await waitForUrl(
          checkoutSubmitPage,
          new RegExp(`/user/my-orders/${createdOrderId}/payment`),
          "checkout submit payment redirect"
        );
        await waitForBodyText(checkoutSubmitPage, "Order Payment");
        await waitForBodyText(checkoutSubmitPage, createdInvoiceNo);
        await waitForBodyText(checkoutSubmitPage, "Grand Total");
        await waitForBodyText(checkoutSubmitPage, "Rp 25.000");
        await waitForBodyText(checkoutSubmitPage, "Payment");
        await waitForBodyText(checkoutSubmitPage, "Amount to Pay");
        await waitForBodyText(checkoutSubmitPage, "Deadline");

        const cartAfterSubmit = await checkoutSubmitClient.request("/api/cart");
        assertStatus(cartAfterSubmit, 200, "checkout submit flow cart after create");
        const cartItemsAfterSubmit =
          cartAfterSubmit.body?.data?.items ??
          cartAfterSubmit.body?.items ??
          cartAfterSubmit.body?.data?.Products ??
          [];
        assert.equal(
          Array.isArray(cartItemsAfterSubmit) ? cartItemsAfterSubmit.length : 0,
          0,
          "checkout submit flow: backend cart should be cleared after create"
        );

        const trackingResponse = await checkoutSubmitClient.request(
          `/api/store/orders/${encodeURIComponent(createdInvoiceNo)}`
        );
        assertStatus(trackingResponse, 200, "checkout submit flow public tracking API");
        const trackedOrder = trackingResponse.body?.data ?? null;
        assert.equal(
          String(trackedOrder?.invoiceNo || trackedOrder?.ref || ""),
          createdInvoiceNo,
          "checkout submit flow: tracking should read the same invoice"
        );
        assert.equal(
          toNumber(trackedOrder?.totalAmount, 0),
          25000,
          "checkout submit flow: tracking total should match payment amount"
        );
        assert.equal(
          String(trackedOrder?.storeSplits?.[0]?.paymentReadModel?.status || ""),
          "CREATED",
          "checkout submit flow: tracking split paymentReadModel should be CREATED"
        );

        await gotoRoute(checkoutSubmitPage, `/order/${encodeURIComponent(createdInvoiceNo)}`);
        await waitForBodyText(checkoutSubmitPage, createdInvoiceNo);
        await waitForBodyText(checkoutSubmitPage, "Organic Banana");
        await waitForBodyText(checkoutSubmitPage, "Rp 25.000");
        createdOrderIds.push(createdOrderId);
      } finally {
        await checkoutSubmitPage.close().catch(() => null);
        await checkoutSubmitContext.close().catch(() => null);
      }

      log("running checkout double-submit browser guard assertions");
      await addProductToCart(doubleSubmitClient, doubleSubmitBuyerUser.id, checkoutProduct.id);
      const doubleSubmitContext = await createAuthedContext(browser, doubleSubmitClient);
      const doubleSubmitPage = await doubleSubmitContext.newPage();
      let createRequestCount = 0;
      let firstRequestKey = "";
      let resolveFirstCreateRequest: () => void = () => undefined;
      let releaseCreateRequest: () => void = () => undefined;
      const firstCreateRequest = new Promise<void>((resolve) => {
        resolveFirstCreateRequest = resolve;
      });
      const releaseCreateResponse = new Promise<void>((resolve) => {
        releaseCreateRequest = resolve;
      });
      try {
        await doubleSubmitPage.route("**/api/checkout/preview", async (route: any) => {
          if (route.request().method() !== "POST") {
            await route.continue();
            return;
          }
          const preview = await fetchCheckoutPreview(doubleSubmitClient);
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ success: true, data: preview }),
          });
        });
        await doubleSubmitPage.route(
          "**/api/checkout/create-multi-store",
          async (route: any) => {
            if (route.request().method() !== "POST") {
              await route.continue();
              return;
            }
            createRequestCount += 1;
            if (!firstRequestKey) {
              try {
                firstRequestKey = String(
                  JSON.parse(route.request().postData() || "{}")?.checkoutRequestKey || ""
                );
              } catch {
                firstRequestKey = "";
              }
            }
            resolveFirstCreateRequest();
            await releaseCreateResponse;
            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                success: true,
                data: {
                  orderId: 900000001,
                  ref: `${RUN_ID}-frontend-double-submit`,
                  invoiceNo: `${RUN_ID}-frontend-double-submit`,
                  checkoutMode: "SINGLE_STORE",
                  paymentStatus: "UNPAID",
                  orderStatus: "pending",
                  paymentMethod: "QRIS",
                  groups: [],
                },
              }),
            });
          }
        );

        await gotoRoute(doubleSubmitPage, "/checkout");
        await doubleSubmitPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
        await waitForBodyText(doubleSubmitPage, checkoutProduct.name);
        await fillCheckoutShippingForm(doubleSubmitPage, "Double Submit");
        await delay(250);
        const doubleSubmitButton = doubleSubmitPage.getByTestId("checkout-submit-cta");
        await doubleSubmitButton.waitFor({ state: "visible", timeout: 15000 });
        assert.equal(
          await doubleSubmitButton.isDisabled().catch(() => true),
          false,
          "double-submit guard: submit CTA should start enabled"
        );
        await doubleSubmitButton.evaluate((button: HTMLButtonElement) => {
          button.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        });
        await delay(500);
        if (createRequestCount === 0) {
          const bodyText = String(
            (await doubleSubmitPage.locator("body").textContent().catch(() => "")) || ""
          )
            .replace(/\s+/g, " ")
            .slice(0, 700);
          const hasSubmitForm = await doubleSubmitButton
            .evaluate((button: HTMLButtonElement) => Boolean(button.form))
            .catch(() => false);
          throw new Error(
            `double-submit guard first create request did not start; hasSubmitForm=${hasSubmitForm}; body="${bodyText}"`
          );
        }
        await withTimeout(
          () => firstCreateRequest,
          5000,
          "double-submit guard first create request"
        );
        assert.ok(
          firstRequestKey.length >= 8,
          "double-submit guard: checkoutRequestKey should be sent with submit"
        );
        assert.equal(
          await doubleSubmitButton.isDisabled().catch(() => false),
          true,
          "double-submit guard: submit CTA should disable while request is pending"
        );
        await doubleSubmitPage
          .getByTestId("checkout-submit-cta")
          .evaluate((button: HTMLButtonElement) => {
            button.form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
          })
          .catch(() => null);
        await delay(250);
        assert.equal(
          createRequestCount,
          1,
          "double-submit guard: frontend sent more than one active checkout create request"
        );
        releaseCreateRequest();
        await delay(100);
      } finally {
        releaseCreateRequest();
        await doubleSubmitPage.close().catch(() => null);
        await doubleSubmitContext.close().catch(() => null);
      }

      await addVariantProductToCart({
        customerClient: buyerClient,
        buyerUserId: buyerUser.id,
        productId: checkoutReadyVariantProduct.id,
        variant: checkoutReadyVariantProduct.variants[0],
        quantity: 1,
      });
      await gotoRoute(buyerPage, "/checkout");
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
      await assertOrganicBananaCheckoutReady(buyerPage, 1, "Rp 25.000");

      await addVariantProductToCart({
        customerClient: buyerClient,
        buyerUserId: buyerUser.id,
        productId: checkoutReadyVariantProduct.id,
        variant: checkoutReadyVariantProduct.variants[0],
        quantity: 2,
      });
      await gotoRoute(buyerPage, "/checkout");
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
      await assertOrganicBananaCheckoutReady(buyerPage, 2, "Rp 50.000");

      await addVariantProductToCart({
        customerClient: buyerClient,
        buyerUserId: buyerUser.id,
        productId: checkoutReadyVariantProduct.id,
        variant: checkoutReadyVariantProduct.variants[0],
        quantity: 3,
      });
      await gotoRoute(buyerPage, "/checkout");
      await buyerPage.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
      await assertOrganicBananaCheckoutReady(buyerPage, 3, "Rp 75.000");
      const qtyThreeDebug = await readCheckoutPreviewDebugSnapshot(buyerPage);
      assert.equal(
        String(qtyThreeDebug?.mismatchReason || "MATCHED"),
        "MATCHED",
        "checkout qty 3 debug: mismatchReason should be MATCHED"
      );
      assert.equal(
        Number(qtyThreeDebug?.rawPreviewGroupsLength || 0),
        1,
        "checkout qty 3 debug: preview should expose one group"
      );
      assert.equal(
        Number(qtyThreeDebug?.rawPreviewItemsLength || 0),
        1,
        "checkout qty 3 debug: preview should expose one item"
      );
      assert.equal(
        String(qtyThreeDebug?.disabledReason || ""),
        "",
        "checkout qty 3 debug: disabledReason should be empty"
      );
      const visibleDebugItems = Array.isArray(qtyThreeDebug?.visibleItemsNormalized)
        ? qtyThreeDebug.visibleItemsNormalized
        : [];
      const previewDebugItems = Array.isArray(qtyThreeDebug?.previewItemsNormalized)
        ? qtyThreeDebug.previewItemsNormalized
        : [];
      assert.equal(
        previewDebugItems.length,
        visibleDebugItems.length,
        "checkout qty 3 debug: preview item count should match visible cart item count"
      );
      const previewLineKeys = previewDebugItems.map((item: any) =>
        item?.cartItemId ? `cart:${item.cartItemId}` : String(item?.lineId || "")
      );
      assert.equal(
        new Set(previewLineKeys).size,
        previewLineKeys.length,
        "checkout qty 3 debug: preview should not expose duplicate cart lines"
      );
      log(
        `checkout qty 3 debug snapshot: reason=${qtyThreeDebug?.mismatchReason || "MATCHED"} visible=${qtyThreeDebug?.visibleFingerprint || ""} preview=${qtyThreeDebug?.previewFingerprint || ""} groups=${qtyThreeDebug?.rawPreviewGroupsLength ?? "n/a"} disabled=${qtyThreeDebug?.disabledReason || ""}`
      );
      if (process.env.E2E_TRUTH_CHECKOUT_SCREENSHOT_PATH) {
        await buyerPage.screenshot({
          path: process.env.E2E_TRUTH_CHECKOUT_SCREENSHOT_PATH,
          fullPage: true,
        });
      }

      await addProductToCart(buyerClient, buyerUser.id, checkoutProduct.id);
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
      const blockedMessage =
        String(blockedItem?.message || "").trim() ||
        resolveInvalidCheckoutMessage(String(blockedItem?.reason || ""));
      assert.match(
        blockedMessage,
        /cannot accept checkout yet|no longer publicly available/i,
        "blocked checkout preview should expose an actionable backend message"
      );

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
  const publicTrackingResponse = await buyerClient.request(
    `/api/store/orders/${encodeURIComponent(approvedScenario.invoiceNo)}`
  );
  assertStatus(publicTrackingResponse, 200, "approved shipment public tracking");
  const publicTracking = publicTrackingResponse.body?.data ?? null;
  assert.equal(Number(publicTracking?.shipmentCount || 0), 1, "shipmentCount should stay visible");
  assert.equal(
    Boolean(publicTracking?.usedLegacyFallback),
    false,
    "approved shipment should use persisted shipment truth"
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
    await waitForAllTexts(sellerPage, [
      expectedSuborderNumber,
      `Payment ${expectedSellerPaymentLabel}`,
      `Operational ${expectedSellerStatusLabel}`,
      "Saved shipment data for this store order.",
      "Shipment record",
    ]);
  } finally {
    await sellerPage.close().catch(() => null);
    await sellerContext.close().catch(() => null);
  }

  log("running shipment browser assertions across public, client, and admin views");
  const buyerShipmentContext = await createAuthedContext(browser, buyerClient);
  const adminShipmentContext = await createAuthedContext(browser, adminClient);
  const publicTrackingPage = await browser.newPage();
  const buyerShipmentPage = await buyerShipmentContext.newPage();
  const adminShipmentPage = await adminShipmentContext.newPage();
  try {
    await gotoRoute(publicTrackingPage, `/order/${encodeURIComponent(approvedScenario.invoiceNo)}`);
    await waitForAllTexts(publicTrackingPage, [
      "Shipping truth stays scoped per store shipment",
      "Persisted shipment",
      "Not assigned yet",
    ]);

    await gotoRoute(buyerShipmentPage, `/user/my-orders/${approvedScenario.orderId}`);
    await waitForAllTexts(buyerShipmentPage, [
      "Persisted shipment",
      "Pending seller assignment",
    ]);

    await gotoRoute(
      adminShipmentPage,
      `/admin/orders/${encodeURIComponent(approvedScenario.invoiceNo)}`
    );
    await waitForAllTexts(adminShipmentPage, [
      "All shipments persisted",
      "Persisted shipment truth",
      "Persisted shipment",
    ]);
  } finally {
    await publicTrackingPage.close().catch(() => null);
    await buyerShipmentPage.close().catch(() => null);
    await adminShipmentPage.close().catch(() => null);
    await buyerShipmentContext.close().catch(() => null);
    await adminShipmentContext.close().catch(() => null);
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

  if (createdAttributeValueIds.length > 0) {
    await sequelize
      .query(`DELETE FROM attribute_values WHERE id IN (${createdAttributeValueIds.map(() => "?").join(", ")})`, {
        replacements: createdAttributeValueIds,
      })
      .catch(() => null);
  }

  if (createdAttributeIds.length > 0) {
    await sequelize
      .query(`DELETE FROM attributes WHERE id IN (${createdAttributeIds.map(() => "?").join(", ")})`, {
        replacements: createdAttributeIds,
      })
      .catch(() => null);
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
    clientOrigin = `http://localhost:${clientPort}`;
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
        VITE_PROXY_API_HOST: APP_HOST,
        VITE_PROXY_API_PORT: String(API_PORT),
      },
      async () => {
        await ensureServerModules();
        await sequelize.authenticate();
        backendServer = app.listen(API_PORT, APP_HOST);
        await once(backendServer, "listening");

        clientProc = spawn(
          "pnpm",
          ["-F", "client", "dev", "--host", "localhost", "--port", String(clientPort), "--strictPort"],
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
