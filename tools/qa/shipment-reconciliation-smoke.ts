import assert from "node:assert/strict";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const APP_HOST = "127.0.0.1";
const API_PORT = Number(process.env.SHIPMENT_QA_API_PORT || 3001);
const DEFAULT_PASSWORD = "mvf-smoke-123";
const DEFAULT_PASSWORD_HASH =
  "$2b$10$BlVCXo.I/DrWMs53W064U.NoNdPrHgxb3wvg3oy0AQmhwE7SEB33.";
const RUN_ID = `shipment-route-qa-${Date.now()}`;
const serverEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../server/.env"
);

loadEnv({ path: serverEnvPath });

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

type StoreFixture = {
  id: number;
  slug: string;
  name: string;
};

type ProductFixture = {
  id: number;
  slug: string;
  name: string;
  storeId: number;
};

type CheckoutGroup = {
  storeId: number;
  suborderId: number;
  paymentId: number;
  storeName: string;
};

type CheckoutScenario = {
  orderId: number;
  invoiceNo: string;
  groups: CheckoutGroup[];
};

let app: any;
let sequelize: any;
let User: any;
let Store: any;
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
let Shipment: any;
let TrackingEvent: any;

const createdUserIds: number[] = [];
const createdStoreIds: number[] = [];
const createdPaymentProfileIds: number[] = [];
const createdProductIds: number[] = [];
const createdOrderIds: number[] = [];

class CookieClient {
  private cookie = "";

  async request(pathname: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) headers.set("Cookie", this.cookie);

    const response = await fetch(`http://${APP_HOST}:${API_PORT}${pathname}`, {
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

const log = (message: string) => console.log(`[shipment-route-qa] ${message}`);

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const withEnv = async (
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>
) => {
  const previous = Object.entries(overrides).map(([key]) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

const ensurePortAvailable = async (port: number) =>
  new Promise<void>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error: any) => {
      reject(new Error(`Port ${port} is unavailable: ${error?.message || error}`));
    });
    server.once("listening", () => {
      server.close(() => resolve());
    });
    server.listen(port, APP_HOST);
  });

async function ensureServerModules() {
  if (app && sequelize) return;
  const appModule = await import("../../server/src/app.js");
  const modelsModule = await import("../../server/src/models/index.js");
  app = appModule.default;
  sequelize = modelsModule.sequelize;
  User = modelsModule.User;
  Store = modelsModule.Store;
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
  Shipment = modelsModule.Shipment;
  TrackingEvent = modelsModule.TrackingEvent;
}

async function createFixtureUser(label: string, role = "customer"): Promise<FixtureUser> {
  const email = `${RUN_ID}-${label}@local.dev`;
  const user = await User.create({
    name: `QA ${label}`,
    email,
    password: DEFAULT_PASSWORD_HASH,
    role,
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password: DEFAULT_PASSWORD };
}

async function createFixtureStore(ownerUserId: number, label: string): Promise<StoreFixture> {
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
    accountName: `QA Account ${storeId}`,
    merchantName: `QA Merchant ${storeId}`,
    merchantId: `QA-${storeId}`,
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
}

async function createFixtureProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
}): Promise<ProductFixture> {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 125000,
    stock: 50,
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
    name: String(product.getDataValue("name") || slug),
    storeId: input.storeId,
  };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: success flag missing`);
}

async function loginAdmin(client: CookieClient, email: string, password: string) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, "admin login");
  assert.ok(response.body?.user?.id, "admin login: missing admin user payload");
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
    await CartItem.destroy({ where: { cartId: cartIds } as any });
    await Cart.destroy({ where: { id: cartIds } as any });
  }
}

const buildShippingDetails = (label: string) => ({
  fullName: `QA ${label}`,
  phoneNumber: "081234567890",
  province: "Jakarta",
  city: "Jakarta Selatan",
  district: "Kebayoran Baru",
  postalCode: "12190",
  streetName: "QA Street",
  houseNumber: "12",
  building: "Tower A",
  otherDetails: `Suite ${label}`,
  markAs: "HOME",
});

async function addProductsToCart(
  buyerClient: CookieClient,
  buyerUserId: number,
  productIds: number[]
) {
  await resetCartForUser(buyerUserId);
  for (const productId of productIds) {
    const response = await buyerClient.request("/api/cart/add", {
      method: "POST",
      body: JSON.stringify({ productId, quantity: 1 }),
    });
    assertStatus(response, 200, `add product ${productId} to cart`);
  }
}

async function createMultiStoreOrder(input: {
  buyerClient: CookieClient;
  buyerUserId: number;
  products: ProductFixture[];
  label: string;
}): Promise<CheckoutScenario> {
  await addProductsToCart(
    input.buyerClient,
    input.buyerUserId,
    input.products.map((product) => product.id)
  );

  const shippingDetails = buildShippingDetails(input.label);
  const response = await input.buyerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        name: shippingDetails.fullName,
        phone: shippingDetails.phoneNumber,
        address: `${shippingDetails.streetName} ${shippingDetails.houseNumber}`,
        notes: `QA ${input.label}`,
      },
      shippingDetails,
    }),
  });

  assertStatus(response, 201, `${input.label} create checkout`);
  assert.equal(Boolean(response.body?.success), true, `${input.label}: checkout success missing`);

  const data = response.body?.data ?? null;
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  assert.equal(
    groups.length,
    input.products.length,
    `${input.label}: expected ${input.products.length} checkout groups, received ${groups.length}`
  );

  const orderId = toNumber(data?.orderId, 0);
  assert.ok(orderId > 0, `${input.label}: missing orderId`);
  createdOrderIds.push(orderId);

  return {
    orderId,
    invoiceNo: String(data?.invoiceNo || data?.ref || orderId),
    groups: groups.map((group: any) => ({
      storeId: toNumber(group?.storeId, 0),
      suborderId: toNumber(group?.suborderId, 0),
      paymentId: toNumber(group?.payment?.id, 0),
      storeName: String(group?.storeName || group?.storeSlug || group?.storeId || ""),
    })),
  };
}

async function submitProof(client: CookieClient, paymentId: number, label: string) {
  const response = await client.request(`/api/payments/${paymentId}/proof`, {
    method: "POST",
    body: JSON.stringify({
      proofImageUrl: `https://example.com/${RUN_ID}-${label}.png`,
      senderName: `Buyer ${label}`,
      senderBankOrWallet: "Bank QA",
      transferAmount: 125000,
      transferTime: new Date().toISOString(),
      note: `Proof ${label}`,
    }),
  });
  assertStatus(response, 201, `${label} submit proof`);
}

async function reviewPayment(
  sellerClient: CookieClient,
  storeId: number,
  paymentId: number,
  label: string
) {
  const response = await sellerClient.request(
    `/api/seller/stores/${storeId}/payments/${paymentId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: "APPROVE",
        note: `${label} approve`,
      }),
    }
  );
  assertStatus(response, 200, `${label} approve payment`);
  assert.equal(Boolean(response.body?.success), true, `${label}: payment review success missing`);
}

async function fetchPublicTracking(invoiceNo: string) {
  const response = await fetch(
    `http://${APP_HOST}:${API_PORT}/api/store/orders/${encodeURIComponent(invoiceNo)}`
  );
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.equal(response.status, 200, `public tracking failed (${response.status}) ${text}`);
  return body?.data ?? body;
}

async function fetchClientDetail(client: CookieClient, orderId: number) {
  const response = await client.request(`/api/store/orders/my/${orderId}`);
  assertStatus(response, 200, "client order detail");
  return response.body?.data ?? response.body?.data?.data ?? null;
}

async function fetchClientGrouped(client: CookieClient, orderId: number) {
  const response = await client.request(`/api/orders/${orderId}/checkout-payment`);
  assertStatus(response, 200, "client grouped order");
  assert.equal(Boolean(response.body?.success), true, "client grouped order: success missing");
  return response.body?.data ?? null;
}

async function fetchSellerDetail(
  client: CookieClient,
  storeId: number,
  suborderId: number
) {
  const response = await client.request(`/api/seller/stores/${storeId}/suborders/${suborderId}`);
  assertStatus(response, 200, "seller order detail");
  assert.equal(Boolean(response.body?.success), true, "seller order detail: success missing");
  return response.body?.data ?? null;
}

async function fetchAdminDetail(client: CookieClient, invoiceNo: string) {
  const response = await client.request(
    `/api/admin/orders/by-invoice/${encodeURIComponent(invoiceNo)}`
  );
  assertStatus(response, 200, "admin order detail");
  assert.equal(Boolean(response.body?.success), true, "admin order detail: success missing");
  return response.body?.data ?? null;
}

async function mutateSellerFulfillment(input: {
  client: CookieClient;
  storeId: number;
  suborderId: number;
  action: "MARK_PROCESSING" | "MARK_SHIPPED" | "MARK_DELIVERED";
  courierCode?: string;
  courierService?: string;
  trackingNumber?: string;
  expectedStatus?: number;
  expectedStatuses?: number[];
}) {
  const response = await input.client.request(
    `/api/seller/stores/${input.storeId}/suborders/${input.suborderId}/fulfillment`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: input.action,
        courierCode: input.courierCode,
        courierService: input.courierService,
        trackingNumber: input.trackingNumber,
      }),
    }
  );

  if (Array.isArray(input.expectedStatuses) && input.expectedStatuses.length > 0) {
    assert.ok(
      input.expectedStatuses.includes(response.status),
      `${input.action} mutation: expected one of ${input.expectedStatuses.join(", ")}, received ${response.status} (${response.text})`
    );
  } else if (input.expectedStatus) {
    assertStatus(response, input.expectedStatus, `${input.action} mutation`);
  } else {
    assertStatus(response, 200, `${input.action} mutation`);
    assert.equal(Boolean(response.body?.success), true, `${input.action}: success missing`);
  }

  return response;
}

const normalizeShipmentSnapshot = (shipment: any) => ({
  suborderId: toNumber(shipment?.suborderId, 0) || null,
  shipmentId: toNumber(shipment?.shipmentId, 0) || null,
  storeId: toNumber(shipment?.storeId, 0) || null,
  storeName: String(shipment?.storeName || "").trim() || null,
  usedLegacyFallback: Boolean(shipment?.usedLegacyFallback),
  shipmentStatus: String(shipment?.shipmentStatus || "").trim().toUpperCase() || null,
  trackingNumber: String(shipment?.trackingNumber || "").trim() || null,
  courierCode: String(shipment?.courierCode || "").trim() || null,
  courierService: String(shipment?.courierService || "").trim() || null,
  latestTrackingStatus:
    String(shipment?.latestTrackingEvent?.status || "").trim().toUpperCase() || null,
  trackingEventStatuses: (Array.isArray(shipment?.trackingEvents) ? shipment.trackingEvents : [])
    .map((event: any) => String(event?.status || "").trim().toUpperCase())
    .filter(Boolean),
});

const snapshotShipments = (shipments: any[]) =>
  (Array.isArray(shipments) ? shipments : [])
    .map((shipment) => normalizeShipmentSnapshot(shipment))
    .sort((left, right) => {
      if ((left.suborderId || 0) !== (right.suborderId || 0)) {
        return (left.suborderId || 0) - (right.suborderId || 0);
      }
      return (left.storeId || 0) - (right.storeId || 0);
    });

const pickOrderShipmentSnapshot = (payload: any) => ({
  shipmentCount: toNumber(payload?.shipmentCount, 0),
  shippingStatus: String(payload?.shippingStatus || "").trim().toUpperCase() || null,
  usedLegacyFallback: Boolean(payload?.usedLegacyFallback),
  shipments: snapshotShipments(payload?.shipments),
});

const assertOrderRouteParity = (label: string, left: any, right: any) => {
  assert.deepEqual(
    pickOrderShipmentSnapshot(left),
    pickOrderShipmentSnapshot(right),
    `${label}: shipment truth mismatch`
  );
};

async function resetCartForUserIds(userIds: number[]) {
  const ids = Array.from(new Set(userIds.filter((id) => Number.isInteger(id) && id > 0)));
  if (ids.length === 0) return;
  const carts = await Cart.findAll({
    where: { userId: ids } as any,
    attributes: ["id"],
  });
  const cartIds = carts
    .map((cart: any) => Number(cart.getDataValue("id")))
    .filter((cartId: number) => Number.isInteger(cartId) && cartId > 0);
  if (cartIds.length > 0) {
    await CartItem.destroy({ where: { cartId: cartIds } as any });
    await Cart.destroy({ where: { id: cartIds } as any });
  }
}

async function cleanupFixtures() {
  try {
    await resetCartForUserIds(createdUserIds);

    const suborders = await Suborder.findAll({
      where: { orderId: createdOrderIds } as any,
      attributes: ["id"],
      raw: true,
    });
    const suborderIds = suborders
      .map((row: any) => Number(row.id))
      .filter((id: number) => id > 0);
    const payments = await Payment.findAll({
      where: { suborderId: suborderIds } as any,
      attributes: ["id"],
      raw: true,
    });
    const paymentIds = payments
      .map((row: any) => Number(row.id))
      .filter((id: number) => id > 0);
    const shipments = await Shipment.findAll({
      where: { orderId: createdOrderIds } as any,
      attributes: ["id"],
      raw: true,
    });
    const shipmentIds = shipments
      .map((row: any) => Number(row.id))
      .filter((id: number) => id > 0);

    if (shipmentIds.length > 0) {
      await TrackingEvent.destroy({ where: { shipmentId: shipmentIds } as any });
      await Shipment.destroy({ where: { id: shipmentIds } as any });
    }
    if (paymentIds.length > 0) {
      await PaymentProof.destroy({ where: { paymentId: paymentIds } as any });
      await PaymentStatusLog.destroy({ where: { paymentId: paymentIds } as any });
      await Payment.destroy({ where: { id: paymentIds } as any });
    }
    if (suborderIds.length > 0) {
      await SuborderItem.destroy({ where: { suborderId: suborderIds } as any });
      await Suborder.destroy({ where: { id: suborderIds } as any });
    }
    if (createdOrderIds.length > 0) {
      await OrderItem.destroy({ where: { orderId: createdOrderIds } as any });
      await Order.destroy({ where: { id: createdOrderIds } as any });
    }
    if (createdProductIds.length > 0) {
      await Product.destroy({ where: { id: createdProductIds } as any });
    }
    if (createdPaymentProfileIds.length > 0) {
      await Store.update(
        { activeStorePaymentProfileId: null } as any,
        { where: { id: createdStoreIds } as any }
      );
      await StorePaymentProfile.destroy({ where: { id: createdPaymentProfileIds } as any });
    }
    if (createdStoreIds.length > 0) {
      await Store.destroy({ where: { id: createdStoreIds } as any });
    }
    if (createdUserIds.length > 0) {
      await User.destroy({ where: { id: createdUserIds } as any });
    }
  } catch (error) {
    console.error("[shipment-route-qa] cleanup failed", error);
  }
}

async function approveAllGroupPayments(
  scenario: CheckoutScenario,
  buyerClient: CookieClient,
  sellerClientsByStoreId: Map<number, CookieClient>
) {
  for (const group of scenario.groups) {
    await submitProof(buyerClient, group.paymentId, `${scenario.invoiceNo}-${group.storeId}`);
    const sellerClient = sellerClientsByStoreId.get(group.storeId);
    assert.ok(sellerClient, `missing seller client for store ${group.storeId}`);
    await reviewPayment(
      sellerClient,
      group.storeId,
      group.paymentId,
      `${scenario.invoiceNo}-${group.storeId}`
    );
  }
}

run().catch((error) => {
  console.error("[shipment-route-qa] failure", error);
  process.exitCode = 1;
});

async function run() {
  await ensureServerModules();
  await ensurePortAvailable(API_PORT);
  await sequelize.authenticate();

  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(API_PORT, APP_HOST, () => resolve(instance));
  });

  try {
    log("creating fixture users and stores");
    const adminUser = await createFixtureUser("admin", "super_admin");
    const sellerOne = await createFixtureUser("seller-one", "seller");
    const sellerTwo = await createFixtureUser("seller-two", "seller");
    const buyer = await createFixtureUser("buyer", "customer");

    const storeOne = await createFixtureStore(sellerOne.id, "store-one");
    const storeTwo = await createFixtureStore(sellerTwo.id, "store-two");
    await createFixturePaymentProfile(storeOne.id);
    await createFixturePaymentProfile(storeTwo.id);

    const productOne = await createFixtureProduct({
      ownerUserId: sellerOne.id,
      storeId: storeOne.id,
      label: "product-one",
    });
    const productTwo = await createFixtureProduct({
      ownerUserId: sellerTwo.id,
      storeId: storeTwo.id,
      label: "product-two",
    });

    log("logging in clients");
    const adminClient = new CookieClient();
    const buyerClient = new CookieClient();
    const sellerClientOne = new CookieClient();
    const sellerClientTwo = new CookieClient();

    await loginAdmin(adminClient, adminUser.email, adminUser.password);
    await login(buyerClient, buyer.email, buyer.password, "buyer login");
    await login(sellerClientOne, sellerOne.email, sellerOne.password, "seller one login");
    await login(sellerClientTwo, sellerTwo.email, sellerTwo.password, "seller two login");

    const sellerClientsByStoreId = new Map<number, CookieClient>([
      [storeOne.id, sellerClientOne],
      [storeTwo.id, sellerClientTwo],
    ]);

    log("verifying feature OFF legacy-safe route behavior");
    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "false",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "false",
      },
      async () => {
        const legacyScenario = await createMultiStoreOrder({
          buyerClient,
          buyerUserId: buyer.id,
          products: [productOne],
          label: "legacy-off",
        });
        const publicTracking = await fetchPublicTracking(legacyScenario.invoiceNo);
        const clientDetail = await fetchClientDetail(buyerClient, legacyScenario.orderId);
        const clientGrouped = await fetchClientGrouped(buyerClient, legacyScenario.orderId);
        const sellerDetail = await fetchSellerDetail(
          sellerClientOne,
          storeOne.id,
          legacyScenario.groups[0]!.suborderId
        );
        const adminDetail = await fetchAdminDetail(adminClient, legacyScenario.invoiceNo);

        assert.equal(toNumber(publicTracking?.shipmentCount, 0), 0, "feature OFF public shipment count");
        assert.equal(toNumber(clientDetail?.shipmentCount, 0), 0, "feature OFF client detail shipment count");
        assert.equal(toNumber(clientGrouped?.shipmentCount, 0), 0, "feature OFF client grouped shipment count");
        assert.equal(toNumber(adminDetail?.shipmentCount, 0), 0, "feature OFF admin shipment count");
        assert.equal(
          Array.isArray(sellerDetail?.shipments) ? sellerDetail.shipments.length : 0,
          0,
          "feature OFF seller shipments should stay hidden"
        );
        assert.equal(Boolean(sellerDetail?.usedLegacyFallback), true, "feature OFF seller legacy flag");
      }
    );

    log("verifying MVP ON + mutation OFF route parity");
    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "true",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "false",
      },
      async () => {
        const scenario = await createMultiStoreOrder({
          buyerClient,
          buyerUserId: buyer.id,
          products: [productOne, productTwo],
          label: "mvp-on-mutation-off",
        });
        await approveAllGroupPayments(scenario, buyerClient, sellerClientsByStoreId);

        const publicTracking = await fetchPublicTracking(scenario.invoiceNo);
        const clientDetail = await fetchClientDetail(buyerClient, scenario.orderId);
        const clientGrouped = await fetchClientGrouped(buyerClient, scenario.orderId);
        const adminDetail = await fetchAdminDetail(adminClient, scenario.invoiceNo);
        const sellerOneDetail = await fetchSellerDetail(
          sellerClientOne,
          storeOne.id,
          scenario.groups.find((group) => group.storeId === storeOne.id)!.suborderId
        );

        assertOrderRouteParity("public vs client detail", publicTracking, clientDetail);
        assertOrderRouteParity("public vs client grouped", publicTracking, clientGrouped);
        assertOrderRouteParity("public vs admin detail", publicTracking, adminDetail);
        assert.equal(
          Array.isArray(sellerOneDetail?.shipments) ? sellerOneDetail.shipments.length : 0,
          1,
          "seller detail should stay scoped to one shipment"
        );
        assert.equal(
          Array.isArray(sellerOneDetail?.shipments?.[0]?.availableShippingActions)
            ? sellerOneDetail.shipments[0].availableShippingActions.every(
                (action: any) => action?.enabled === false
              )
            : false,
          true,
          "mutation-off seller detail should expose no enabled shipment actions"
        );
        assert.equal(
          Boolean(adminDetail?.shipmentAuditMeta?.persistedShipmentCount >= 2),
          true,
          "admin audit should see persisted shipment coverage"
        );
        assert.equal(
          Array.isArray(adminDetail?.suborderShipmentSummary)
            ? adminDetail.suborderShipmentSummary.length
            : 0,
          2,
          "admin audit should expose suborder shipment summary"
        );

        const mutationAttempt = await mutateSellerFulfillment({
          client: sellerClientOne,
          storeId: storeOne.id,
          suborderId: scenario.groups.find((group) => group.storeId === storeOne.id)!.suborderId,
          action: "MARK_PROCESSING",
          expectedStatus: 409,
        });
        assert.ok(
          ["SHIPMENT_MUTATION_DISABLED", "FULFILLMENT_STATUS_ALREADY_SET"].includes(
            String(mutationAttempt.body?.code || "").toUpperCase()
          ),
          `mutation-off should stay blocked, received ${String(
            mutationAttempt.body?.code || ""
          ).toUpperCase()}`
        );
      }
    );

    log("verifying MVP ON + mutation ON reconciliation across public/client/seller/admin");
    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "true",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "true",
      },
      async () => {
        const scenario = await createMultiStoreOrder({
          buyerClient,
          buyerUserId: buyer.id,
          products: [productOne, productTwo],
          label: "mvp-on-mutation-on",
        });
        await approveAllGroupPayments(scenario, buyerClient, sellerClientsByStoreId);

        const groupOne = scenario.groups.find((group) => group.storeId === storeOne.id)!;
        const groupTwo = scenario.groups.find((group) => group.storeId === storeTwo.id)!;

        await mutateSellerFulfillment({
          client: sellerClientOne,
          storeId: storeOne.id,
          suborderId: groupOne.suborderId,
          action: "MARK_PROCESSING",
          expectedStatuses: [200, 409],
        });
        await mutateSellerFulfillment({
          client: sellerClientOne,
          storeId: storeOne.id,
          suborderId: groupOne.suborderId,
          action: "MARK_SHIPPED",
          courierCode: "JNE",
          courierService: "REG",
          trackingNumber: "JNE-ROUTE-QA-001",
        });

        await mutateSellerFulfillment({
          client: sellerClientTwo,
          storeId: storeTwo.id,
          suborderId: groupTwo.suborderId,
          action: "MARK_PROCESSING",
          expectedStatuses: [200, 409],
        });
        await mutateSellerFulfillment({
          client: sellerClientTwo,
          storeId: storeTwo.id,
          suborderId: groupTwo.suborderId,
          action: "MARK_SHIPPED",
          courierCode: "JNT",
          courierService: "EZ",
          trackingNumber: "JNT-ROUTE-QA-002",
        });
        await mutateSellerFulfillment({
          client: sellerClientTwo,
          storeId: storeTwo.id,
          suborderId: groupTwo.suborderId,
          action: "MARK_DELIVERED",
        });

        const publicTracking = await fetchPublicTracking(scenario.invoiceNo);
        const clientDetail = await fetchClientDetail(buyerClient, scenario.orderId);
        const clientGrouped = await fetchClientGrouped(buyerClient, scenario.orderId);
        const sellerOneDetail = await fetchSellerDetail(sellerClientOne, storeOne.id, groupOne.suborderId);
        const sellerTwoDetail = await fetchSellerDetail(sellerClientTwo, storeTwo.id, groupTwo.suborderId);
        const adminDetail = await fetchAdminDetail(adminClient, scenario.invoiceNo);

        assertOrderRouteParity("public vs client detail (mutation on)", publicTracking, clientDetail);
        assertOrderRouteParity("public vs client grouped (mutation on)", publicTracking, clientGrouped);
        assertOrderRouteParity("public vs admin detail (mutation on)", publicTracking, adminDetail);

        const publicSnapshots = snapshotShipments(publicTracking?.shipments);
        assert.equal(publicSnapshots.length, 2, "mutation-on public shipment count");
        assert.equal(
          publicSnapshots.some((shipment) => shipment.shipmentStatus === "SHIPPED"),
          true,
          "mutation-on should expose a shipped shipment"
        );
        assert.equal(
          publicSnapshots.some((shipment) => shipment.shipmentStatus === "DELIVERED"),
          true,
          "mutation-on should expose a delivered shipment"
        );

        const sellerOneSnapshot = snapshotShipments(sellerOneDetail?.shipments);
        const sellerTwoSnapshot = snapshotShipments(sellerTwoDetail?.shipments);
        assert.equal(sellerOneSnapshot.length, 1, "seller one scoped shipment count");
        assert.equal(sellerTwoSnapshot.length, 1, "seller two scoped shipment count");
        assert.equal(sellerOneSnapshot[0]?.shipmentStatus, "SHIPPED", "seller one shipment status");
        assert.equal(sellerTwoSnapshot[0]?.shipmentStatus, "DELIVERED", "seller two shipment status");
        assert.equal(
          sellerOneSnapshot[0]?.trackingNumber,
          "JNE-ROUTE-QA-001",
          "seller one tracking number should reconcile"
        );
        assert.equal(
          sellerTwoSnapshot[0]?.trackingNumber,
          "JNT-ROUTE-QA-002",
          "seller two tracking number should reconcile"
        );

        const crossStoreAttempt = await sellerClientOne.request(
          `/api/seller/stores/${storeTwo.id}/suborders/${groupTwo.suborderId}`
        );
        assert.ok(
          crossStoreAttempt.status === 403 || crossStoreAttempt.status === 404,
          `seller cross-store guard expected 403/404, received ${crossStoreAttempt.status}`
        );

        assert.equal(
          Array.isArray(adminDetail?.suborderShipmentSummary)
            ? adminDetail.suborderShipmentSummary.length
            : 0,
          2,
          "admin detail suborder shipment summary should cover both stores"
        );
        assert.equal(
          Number(adminDetail?.shipmentAuditMeta?.compatibilityMismatchCount || 0),
          0,
          "admin audit should not report compatibility mismatch for synced order"
        );
      }
    );

    log("route-level shipment reconciliation smoke passed");
  } finally {
    await cleanupFixtures();
    await new Promise<void>((resolve, reject) => {
      server.close((error: Error | undefined) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}
