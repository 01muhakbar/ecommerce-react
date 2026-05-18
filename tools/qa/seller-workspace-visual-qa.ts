import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { Op } from "sequelize";

const APP_HOST = "127.0.0.1";
const DEFAULT_PASSWORD = "mvf-smoke-123";
const DEFAULT_PASSWORD_HASH = "$2b$10$BlVCXo.I/DrWMs53W064U.NoNdPrHgxb3wvg3oy0AQmhwE7SEB33.";
const RUN_ID = `seller-visual-${Date.now()}`;
const DATE_STAMP = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Makassar",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
  .format(new Date())
  .replace(/-/g, "");
const ARTIFACT_ROOT = path.resolve(
  process.env.SELLER_VISUAL_QA_ARTIFACT_DIR ||
    `.codex-artifacts/p1-seller-workspace-visual-qa-${DATE_STAMP}`
);
const serverEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../server/.env"
);

loadEnv({ path: serverEnvPath });

let apiPort = Number(
  process.env.SELLER_VISUAL_QA_API_PORT || process.env.E2E_TRUTH_API_PORT || 0
);
let clientPort = 0;
let clientBase = "";

let app: any;
let sequelize: any;
let User: any;
let Store: any;
let StoreMember: any;
let StoreRole: any;
let StoreAuditLog: any;
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

type TargetPage = {
  key: string;
  label: string;
  path: string;
  waitFor: string;
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

    const response = await fetch(`http://${APP_HOST}:${apiPort}${pathname}`, {
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
const createdStoreMemberIds: number[] = [];
const createdAuditLogIds: number[] = [];
const createdPaymentProfileIds: number[] = [];
const createdProductIds: number[] = [];
const createdOrderIds: number[] = [];

const log = (message: string) => console.log(`[seller-visual-qa] ${message}`);

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

const ensurePortAvailable = (port: number) =>
  new Promise<void>((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", (error: any) => {
      reject(new Error(`Port ${port} is unavailable: ${error?.message || error}`));
    });
    tester.once("listening", () => {
      tester.close(() => resolve());
    });
    tester.listen(port, APP_HOST);
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

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is not installed. Install project dependencies first.");
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
  if (app && sequelize && User && Store && Product) return;
  const appModule = await import("../../server/src/app.js");
  const modelsModule = await import("../../server/src/models/index.js");
  app = appModule.default;
  sequelize = modelsModule.sequelize;
  User = modelsModule.User;
  Store = modelsModule.Store;
  StoreMember = modelsModule.StoreMember;
  StoreRole = modelsModule.StoreRole;
  StoreAuditLog = modelsModule.StoreAuditLog;
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
    name: `Visual QA ${label}`,
    email,
    password: DEFAULT_PASSWORD_HASH,
    role,
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
    name: "Visual QA Seller Store",
    slug,
    status: "ACTIVE",
    description: "Daily essentials and curated products for local buyers.",
    logoUrl: "https://placehold.co/320x320/png?text=QA+Store",
    bannerUrl: "https://placehold.co/1200x420/png?text=Seller+Store",
    email: "seller-visual-qa@local.dev",
    phone: "081234567890",
    whatsapp: "081234567890",
    websiteUrl: "https://example.com/store",
    instagramUrl: "https://instagram.com/example",
    addressLine1: "Jl. Visual QA No. 12",
    addressLine2: "Unit Seller Workspace",
    city: "Makassar",
    province: "Sulawesi Selatan",
    postalCode: "90111",
    country: "Indonesia",
    shippingSetup: {
      shippingEnabled: true,
      originContactName: "Visual QA Seller",
      originPhone: "081234567890",
      originAddressLine1: "Jl. Visual QA No. 12",
      originAddressLine2: "Unit Seller Workspace",
      originDistrict: "Panakkukang",
      originCity: "Makassar",
      originProvince: "Sulawesi Selatan",
      originPostalCode: "90111",
      originCountry: "Indonesia",
      pickupNotes: "Pickup at lobby after seller confirms packing.",
    },
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
    accountName: "Visual QA Account",
    merchantName: "Visual QA Merchant",
    merchantId: `VISUAL-QA-${storeId}`,
    qrisImageUrl: "https://placehold.co/600x600/png?text=QRIS",
    qrisPayload: `${RUN_ID}-${storeId}-qris`,
    instructionText: "Transfer exactly the checkout amount, then upload the proof.",
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

async function createFixtureProduct(input: { ownerUserId: number; storeId: number }) {
  const slug = slugify(`${RUN_ID}-product`);
  const product = await Product.create({
    name: "Visual QA Product Snapshot",
    slug,
    sku: slug.toUpperCase(),
    price: 125000,
    stock: 20,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: "Fixture product for seller workspace visual QA.",
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug, name: String(product.getDataValue("name") || slug) };
}

async function requireStoreRole(code: string) {
  const role = await StoreRole.findOne({ where: { code } as any });
  assert.ok(role, `Missing store role fixture seed: ${code}`);
  return {
    id: Number(role.getDataValue("id")),
    code: String(role.getDataValue("code") || code),
    name: String(role.getDataValue("name") || code),
  };
}

async function createStoreMember(input: {
  storeId: number;
  userId: number;
  roleId: number;
  invitedByUserId: number;
  status?: "ACTIVE" | "INVITED" | "DISABLED" | "REMOVED";
}) {
  const now = new Date();
  const member = await StoreMember.create({
    storeId: input.storeId,
    userId: input.userId,
    storeRoleId: input.roleId,
    status: input.status || "ACTIVE",
    invitedByUserId: input.invitedByUserId,
    invitedAt: now,
    acceptedAt: input.status === "INVITED" ? null : now,
  } as any);
  const id = Number(member.getDataValue("id"));
  createdStoreMemberIds.push(id);
  return { id };
}

async function createTeamFixtures(input: {
  storeId: number;
  sellerUserId: number;
  teamUserId: number;
}) {
  const ownerRole = await requireStoreRole("STORE_OWNER");
  const orderRole = await requireStoreRole("ORDER_MANAGER");
  const financeRole = await requireStoreRole("FINANCE_VIEWER");

  const owner = await createStoreMember({
    storeId: input.storeId,
    userId: input.sellerUserId,
    roleId: ownerRole.id,
    invitedByUserId: input.sellerUserId,
  });
  const teammate = await createStoreMember({
    storeId: input.storeId,
    userId: input.teamUserId,
    roleId: orderRole.id,
    invitedByUserId: input.sellerUserId,
  });

  const logs = await StoreAuditLog.bulkCreate(
    [
      {
        storeId: input.storeId,
        actorUserId: input.sellerUserId,
        targetUserId: input.teamUserId,
        targetMemberId: teammate.id,
        action: "TEAM_MEMBER_ATTACH",
        beforeState: null,
        afterState: JSON.stringify({
          userId: input.teamUserId,
          roleCode: orderRole.code,
          roleName: orderRole.name,
          status: "ACTIVE",
        }),
      },
      {
        storeId: input.storeId,
        actorUserId: input.sellerUserId,
        targetUserId: input.teamUserId,
        targetMemberId: teammate.id,
        action: "TEAM_MEMBER_ROLE_CHANGE",
        beforeState: JSON.stringify({
          userId: input.teamUserId,
          roleCode: financeRole.code,
          roleName: financeRole.name,
          status: "ACTIVE",
        }),
        afterState: JSON.stringify({
          userId: input.teamUserId,
          roleCode: orderRole.code,
          roleName: orderRole.name,
          status: "ACTIVE",
        }),
      },
    ] as any[]
  );

  createdAuditLogIds.push(...logs.map((log: any) => Number(log.getDataValue("id"))));
  return { ownerMemberId: owner.id, teammateMemberId: teammate.id };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: login did not return success`);
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

function buildShippingDetails(label: string) {
  return {
    fullName: `Visual QA ${label}`,
    phoneNumber: "081234567890",
    province: "Sulawesi Selatan",
    city: "Makassar",
    district: "Panakkukang",
    postalCode: "90111",
    streetName: "Jl. Pembeli QA",
    houseNumber: "34",
    building: "Apartemen QA",
    otherDetails: `Unit ${label}`,
    markAs: "HOME",
  };
}

async function createCheckoutOrder(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
}) {
  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  const shippingDetails = buildShippingDetails("Seller Visual");
  const response = await input.customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        name: shippingDetails.fullName,
        phone: shippingDetails.phoneNumber,
        address: `${shippingDetails.streetName} ${shippingDetails.houseNumber}`,
        notes: "Visual QA seller workspace order",
      },
      shippingDetails,
    }),
  });
  assertStatus(response, 201, "create checkout order");
  assert.equal(Boolean(response.body?.success), true, "checkout did not return success");

  const data = response.body?.data ?? null;
  const group = Array.isArray(data?.groups) ? data.groups[0] : null;
  const orderId = toNumber(data?.orderId, 0);
  const suborderId = toNumber(group?.suborderId, 0);
  const paymentId = toNumber(group?.payment?.id, 0);
  assert.ok(orderId > 0, "orderId missing");
  assert.ok(suborderId > 0, "suborderId missing");
  assert.ok(paymentId > 0, "paymentId missing");
  createdOrderIds.push(orderId);
  return {
    orderId,
    suborderId,
    paymentId,
    invoiceNo: String(data?.invoiceNo || data?.ref || orderId),
  };
}

async function submitProof(customerClient: CookieClient, paymentId: number) {
  const response = await customerClient.request(`/api/payments/${paymentId}/proof`, {
    method: "POST",
    body: JSON.stringify({
      proofImageUrl: "https://placehold.co/800x1100/png?text=Payment+Proof",
      senderName: "Visual QA Buyer",
      senderBankOrWallet: "Bank Visual QA",
      transferAmount: 125000,
      transferTime: new Date().toISOString(),
      note: "Buyer proof for seller visual QA.",
    }),
  });
  assertStatus(response, 201, "submit payment proof");
  assert.equal(Boolean(response.body?.success), true, "proof submit missing success");
}

async function createAuthedContext(browser: any, client: CookieClient, viewport: any) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  await context.addInitScript(() => {
    try {
      window.localStorage.setItem("authSessionHint", "true");
    } catch {
      // ignore localStorage bootstrap issues in QA setup
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

async function waitForBodyText(page: any, expected: string, timeoutMs = 20000) {
  const locator = page.locator("body");
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const text = await locator.textContent();
    if (String(text || "").includes(expected)) return;
    await delay(250);
  }
  const text = String((await locator.textContent().catch(() => "")) || "")
    .replace(/\s+/g, " ")
    .slice(0, 700);
  throw new Error(`Expected page to include "${expected}", received "${text}"`);
}

async function inspectPage(page: any) {
  const developerTerms = [
    "raw payload",
    "mutation",
    "metadata",
    "backend",
    "AUDIT_LOG_VIEW",
    "UNKNOWN",
    "Log #",
    "Member #",
    "Category: AUDIT",
  ];
  return page.evaluate((terms: string[]) => {
    const root = document.documentElement;
    const bodyText = String(document.body?.innerText || "").replace(/\s+/g, " ").trim();
    const rootOverflowPx = Math.max(0, root.scrollWidth - root.clientWidth);
    return {
      url: window.location.pathname,
      rootOverflowPx,
      bodyTextSample: bodyText.slice(0, 500),
      developerCopyHits: terms.filter((term) =>
        bodyText.toLowerCase().includes(term.toLowerCase())
      ),
    };
  }, developerTerms);
}

async function captureSellerWorkspace(browser: any, sellerClient: CookieClient, targets: TargetPage[]) {
  const viewports = [
    { name: "desktop-1440", width: 1440, height: 1100 },
    { name: "tablet-768", width: 768, height: 1100 },
    { name: "mobile-390", width: 390, height: 1000 },
  ];
  const results: any[] = [];

  for (const viewport of viewports) {
    const context = await createAuthedContext(browser, sellerClient, viewport);
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("pageerror", (error: Error) => consoleErrors.push(error.message));
    page.on("console", (message: any) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    for (const target of targets) {
      const screenshotDir = path.join(ARTIFACT_ROOT, viewport.name);
      fs.mkdirSync(screenshotDir, { recursive: true });
      const screenshotPath = path.join(screenshotDir, `${target.key}.png`);
      await page.goto(`${clientBase}${target.path}`, { waitUntil: "load", timeout: 45000 });
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => null);
      await waitForBodyText(page, target.waitFor);
      await delay(500);
      const inspection = await inspectPage(page);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({
        viewport: viewport.name,
        page: target.key,
        label: target.label,
        path: target.path,
        screenshotPath: path.relative(process.cwd(), screenshotPath),
        inspection,
      });
      log(`${viewport.name} ${target.key} captured`);
    }

    await context.close();
    if (consoleErrors.length > 0) {
      results.push({
        viewport: viewport.name,
        page: "console",
        consoleErrors: [...new Set(consoleErrors)].slice(0, 12),
      });
    }
  }

  fs.mkdirSync(ARTIFACT_ROOT, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_ROOT, "summary.json"),
    JSON.stringify(results, null, 2),
    "utf8"
  );
  return results;
}

async function runScenario(browser: any) {
  log("creating seller, store, team, order, and payment proof fixtures");
  const sellerUser = await createFixtureUser("seller", "seller");
  const buyerUser = await createFixtureUser("buyer", "customer");
  const teamUser = await createFixtureUser("team-member", "seller");
  const store = await createFixtureStore(sellerUser.id);
  await createFixturePaymentProfile(store.id);
  await createTeamFixtures({
    storeId: store.id,
    sellerUserId: sellerUser.id,
    teamUserId: teamUser.id,
  });
  const product = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: store.id,
  });

  const sellerClient = new CookieClient();
  const buyerClient = new CookieClient();
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await login(buyerClient, buyerUser.email, buyerUser.password, "buyer login");
  const order = await createCheckoutOrder({
    customerClient: buyerClient,
    buyerUserId: buyerUser.id,
    productId: product.id,
  });
  await submitProof(buyerClient, order.paymentId);

  const base = `/seller/stores/${encodeURIComponent(store.slug)}`;
  const targets: TargetPage[] = [
    {
      key: "payment-setup",
      label: "Payment Setup",
      path: `${base}/payment-profile`,
      waitFor: "Payment setup",
    },
    {
      key: "orders",
      label: "Orders",
      path: `${base}/orders`,
      waitFor: "Orders",
    },
    {
      key: "payment-review",
      label: "Payment Review",
      path: `${base}/payment-review`,
      waitFor: "Payment review",
    },
    {
      key: "store-profile",
      label: "Store Profile",
      path: `${base}/store-profile`,
      waitFor: "Store profile",
    },
    {
      key: "team",
      label: "Team",
      path: `${base}/team`,
      waitFor: "Team",
    },
    {
      key: "team-audit",
      label: "Team Audit",
      path: `${base}/team/audit`,
      waitFor: "Team activity",
    },
    {
      key: "order-detail",
      label: "Order Detail",
      path: `${base}/orders/${encodeURIComponent(String(order.suborderId))}`,
      waitFor: "Fulfillment Actions",
    },
  ];

  const results = await captureSellerWorkspace(browser, sellerClient, targets);
  const overflowIssues = results.filter((entry) => entry.inspection?.rootOverflowPx > 0);
  const developerCopyHits = results.filter(
    (entry) => Array.isArray(entry.inspection?.developerCopyHits) &&
      entry.inspection.developerCopyHits.length > 0
  );

  log(`artifacts saved to ${path.relative(process.cwd(), ARTIFACT_ROOT)}`);
  log(`root overflow issues: ${overflowIssues.length}`);
  log(`developer-copy hits: ${developerCopyHits.length}`);
  console.log(
    JSON.stringify(
      {
        artifactRoot: path.relative(process.cwd(), ARTIFACT_ROOT),
        screenshots: results.filter((entry) => entry.screenshotPath).length,
        overflowIssues: overflowIssues.map((entry) => ({
          viewport: entry.viewport,
          page: entry.page,
          px: entry.inspection.rootOverflowPx,
        })),
        developerCopyHits: developerCopyHits.map((entry) => ({
          viewport: entry.viewport,
          page: entry.page,
          hits: entry.inspection.developerCopyHits,
        })),
      },
      null,
      2
    )
  );
}

async function cleanupFixtures() {
  if (!sequelize) return;

  if (createdOrderIds.length > 0) {
    const suborders = await Suborder.findAll({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      attributes: ["id"],
    });
    const suborderIds = suborders
      .map((suborder: any) => Number(suborder.getDataValue("id")))
      .filter(Boolean);
    const payments = suborderIds.length
      ? await Payment.findAll({
          where: { suborderId: { [Op.in]: suborderIds } } as any,
          attributes: ["id"],
        })
      : [];
    const paymentIds = payments
      .map((payment: any) => Number(payment.getDataValue("id")))
      .filter(Boolean);

    if (paymentIds.length > 0) {
      await PaymentProof.destroy({ where: { paymentId: { [Op.in]: paymentIds } } as any }).catch(
        () => null
      );
      await PaymentStatusLog.destroy({
        where: { paymentId: { [Op.in]: paymentIds } } as any,
      }).catch(() => null);
      await Payment.destroy({ where: { id: { [Op.in]: paymentIds } } as any }).catch(() => null);
    }
    if (suborderIds.length > 0) {
      await SuborderItem.destroy({ where: { suborderId: { [Op.in]: suborderIds } } as any }).catch(
        () => null
      );
      await Suborder.destroy({ where: { id: { [Op.in]: suborderIds } } as any }).catch(
        () => null
      );
    }
    await OrderItem.destroy({ where: { orderId: { [Op.in]: createdOrderIds } } as any }).catch(
      () => null
    );
    await Order.destroy({ where: { id: { [Op.in]: createdOrderIds } } as any }).catch(() => null);
  }

  if (createdUserIds.length > 0) {
    const carts = await Cart.findAll({
      where: { userId: { [Op.in]: createdUserIds } } as any,
      attributes: ["id"],
    });
    const cartIds = carts.map((cart: any) => Number(cart.getDataValue("id"))).filter(Boolean);
    if (cartIds.length > 0) {
      await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } } as any }).catch(
        () => null
      );
      await Cart.destroy({ where: { id: { [Op.in]: cartIds } } as any }).catch(() => null);
    }
  }

  if (createdAuditLogIds.length > 0) {
    await StoreAuditLog.destroy({
      where: { id: { [Op.in]: createdAuditLogIds } } as any,
    }).catch(() => null);
  }
  if (createdStoreIds.length > 0) {
    await StoreAuditLog.destroy({
      where: { storeId: { [Op.in]: createdStoreIds } } as any,
    }).catch(() => null);
  }
  if (createdStoreMemberIds.length > 0) {
    await StoreMember.destroy({
      where: { id: { [Op.in]: createdStoreMemberIds } } as any,
      force: true,
    }).catch(() => null);
  }
  if (createdProductIds.length > 0) {
    await Product.destroy({ where: { id: { [Op.in]: createdProductIds } } as any }).catch(
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

async function main() {
  let clientProc: any = null;
  let backendServer: any = null;
  let browser: any = null;

  try {
    if (apiPort > 0) await ensurePortAvailable(apiPort);
    else apiPort = await getFreePort();
    clientPort = await getFreePort();
    clientBase = `http://localhost:${clientPort}`;
    const smokeCorsOrigins = [
      clientBase,
      `http://${APP_HOST}:${apiPort}`,
      `http://localhost:${apiPort}`,
    ].join(",");

    await withEnv(
      {
        COOKIE_SECURE: "false",
        CLIENT_URL: clientBase,
        CORS_ORIGIN: smokeCorsOrigins,
        NODE_ENV: "development",
        VITE_PROXY_API_HOST: APP_HOST,
        VITE_PROXY_API_PORT: String(apiPort),
      },
      async () => {
        await ensureServerModules();
        await sequelize.authenticate();
        backendServer = app.listen(apiPort, APP_HOST);
        await once(backendServer, "listening");

        clientProc = spawn(
          "pnpm",
          [
            "-F",
            "client",
            "dev",
            "--host",
            "localhost",
            "--port",
            String(clientPort),
            "--strictPort",
          ],
          { stdio: "inherit", shell: true }
        );

        const apiReady = await withTimeout(
          () => waitFor(`http://${APP_HOST}:${apiPort}/api/health`, 30000),
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
      console.error("[seller-visual-qa] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize?.close().catch(() => null);
  }
}

main().catch((error) => {
  console.error("[seller-visual-qa] FAIL", error);
  process.exitCode = 1;
});
