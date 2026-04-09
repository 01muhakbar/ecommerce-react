import "dotenv/config";
import assert from "node:assert/strict";
import net from "node:net";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import app from "../app.js";
import {
  Cart,
  CartItem,
  Order,
  OrderItem,
  Payment,
  PaymentProof,
  PaymentStatusLog,
  Product,
  Shipment,
  Store,
  StoreMember,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  TrackingEvent,
  User,
  sequelize,
} from "../models/index.js";
import { buildOrderShippingReadModel } from "../services/orderShippingReadModel.service.js";

const APP_HOST = "127.0.0.1";
const API_PORT = Number(process.env.SHIPMENT_SMOKE_API_PORT || 3105);
const BASE_URL = `http://${APP_HOST}:${API_PORT}`;
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `shipment-smoke-${Date.now()}`;

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

type ProductFixture = {
  id: number;
  storeId: number;
};

type ScenarioGroup = {
  storeId: number;
  suborderId: number;
  paymentId: number;
};

type CheckoutScenario = {
  orderId: number;
  invoiceNo: string;
  groups: ScenarioGroup[];
};

class CookieClient {
  private cookie = "";

  async request(pathname: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) headers.set("Cookie", this.cookie);
    const response = await fetch(`${BASE_URL}${pathname}`, { ...init, headers });
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

const logStep = (label: string) => console.log(`[shipment-regression] ${label}`);
const logPass = (label: string) => console.log(`[shipment-regression] PASS ${label}`);

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

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

async function createFixtureUser(label: string, role = "customer"): Promise<FixtureUser> {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `Shipment ${label}`,
    email,
    password: hashed,
    role,
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password: DEFAULT_PASSWORD };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = slugify(`${RUN_ID}-${label}`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-${label}`,
    slug,
    status: "ACTIVE",
    phone: "+628111111111",
    addressLine1: "Jl Shipment QA No. 1",
    city: "Jakarta",
    province: "DKI Jakarta",
    postalCode: "10110",
    country: "Indonesia",
    shippingSetup: {
      shippingEnabled: true,
      originContactName: `${RUN_ID}-${label}`,
      originPhone: "+628111111111",
      originAddressLine1: "Jl Shipment QA No. 1",
      originCity: "Jakarta",
      originProvince: "DKI Jakarta",
      originPostalCode: "10110",
      originCountry: "Indonesia",
      pickupNotes: "Smoke shipment ready origin.",
    },
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug };
}

async function createFixturePaymentProfile(storeId: number) {
  const now = new Date();
  const profile = await StorePaymentProfile.create({
    storeId,
    providerCode: "MANUAL_QRIS",
    paymentType: "QRIS_STATIC",
    version: 1,
    snapshotStatus: "ACTIVE",
    accountName: `Shipment Account ${storeId}`,
    merchantName: `Shipment Merchant ${storeId}`,
    merchantId: `SHIPMENT-${storeId}`,
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
    stock: 25,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Shipment fixture ${slug}`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, storeId: input.storeId };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: login missing success`);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function resetCartForUser(userId: number) {
  const carts = await Cart.findAll({ where: { userId } as any, attributes: ["id"] });
  const cartIds = carts
    .map((cart) => Number(cart.getDataValue("id")))
    .filter((cartId) => Number.isInteger(cartId) && cartId > 0);

  if (cartIds.length > 0) {
    await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } } as any });
    await Cart.destroy({ where: { id: { [Op.in]: cartIds } } as any });
  }
}

const buildShippingDetails = (label: string) => ({
  fullName: `Shipment ${label}`,
  phoneNumber: "081234567890",
  province: "Jakarta",
  city: "Jakarta Selatan",
  district: "Kebayoran Baru",
  postalCode: "12190",
  streetName: "Shipment Street",
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
        notes: `Shipment smoke ${input.label}`,
      },
      shippingDetails,
    }),
  });

  assertStatus(response, 201, `${input.label} create checkout`);
  assert.equal(Boolean(response.body?.success), true, `${input.label}: checkout missing success`);
  const data = response.body?.data ?? null;
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  assert.equal(groups.length, input.products.length, `${input.label}: expected checkout groups`);
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
    })),
  };
}

async function submitProof(client: CookieClient, paymentId: number, label: string) {
  const response = await client.request(`/api/payments/${paymentId}/proof`, {
    method: "POST",
    body: JSON.stringify({
      proofImageUrl: `https://example.com/${RUN_ID}-${label}.png`,
      senderName: `Buyer ${label}`,
      senderBankOrWallet: "Bank Shipment",
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
  } else {
    assertStatus(response, input.expectedStatus || 200, `${input.action} mutation`);
  }
  return response;
}

async function getSellerStoreProfile(client: CookieClient, storeId: number) {
  return client.request(`/api/seller/stores/${storeId}/store-profile`);
}

async function patchSellerStoreProfile(
  client: CookieClient,
  storeId: number,
  payload: Record<string, unknown>
) {
  return client.request(`/api/seller/stores/${storeId}/store-profile`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

async function getSellerWorkspaceContext(client: CookieClient, storeId: number) {
  return client.request(`/api/seller/stores/${storeId}/context`);
}

async function getSellerSubordersList(client: CookieClient, storeId: number) {
  return client.request(`/api/seller/stores/${storeId}/suborders`);
}

async function loadOrderSuborders(orderId: number) {
  return Suborder.findAll({
    where: { orderId } as any,
    include: [
      {
        model: Store,
        as: "store",
        attributes: ["id", "name", "slug"],
        required: false,
      },
      {
        model: Shipment,
        as: "shipment",
        required: false,
        include: [{ model: TrackingEvent, as: "trackingEvents", required: false }],
      },
    ],
    order: [["id", "ASC"]],
  });
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

    const shipments = await Shipment.findAll({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      attributes: ["id"],
    }).catch(() => []);
    const shipmentIds = (Array.isArray(shipments) ? shipments : [])
      .map((row: any) => toNumber(row?.getDataValue?.("id") ?? row?.id, 0))
      .filter((id: number) => id > 0);

    if (shipmentIds.length > 0) {
      await TrackingEvent.destroy({
        where: { shipmentId: { [Op.in]: shipmentIds } } as any,
        force: true,
      }).catch(() => null);
      await Shipment.destroy({
        where: { id: { [Op.in]: shipmentIds } } as any,
        force: true,
      }).catch(() => null);
    }

    if (paymentIds.length > 0) {
      await PaymentStatusLog.destroy({
        where: { paymentId: { [Op.in]: paymentIds } } as any,
        force: true,
      }).catch(() => null);
      await PaymentProof.destroy({
        where: { paymentId: { [Op.in]: paymentIds } } as any,
        force: true,
      }).catch(() => null);
      await Payment.destroy({
        where: { id: { [Op.in]: paymentIds } } as any,
        force: true,
      }).catch(() => null);
    }

    if (suborderIds.length > 0) {
      await SuborderItem.destroy({
        where: { suborderId: { [Op.in]: suborderIds } } as any,
        force: true,
      }).catch(() => null);
      await Suborder.destroy({
        where: { id: { [Op.in]: suborderIds } } as any,
        force: true,
      }).catch(() => null);
    }

    await OrderItem.destroy({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      force: true,
    }).catch(() => null);
    await Order.destroy({
      where: { id: { [Op.in]: createdOrderIds } } as any,
      force: true,
    }).catch(() => null);
  }

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
  await ensurePortAvailable(API_PORT);
  await sequelize.authenticate();
  const server = await new Promise<any>((resolve) => {
    const instance = app.listen(API_PORT, APP_HOST, () => resolve(instance));
  });

  try {
    logStep("creating fixture users and stores");
    await createFixtureUser("admin", "super_admin");
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

    logStep("authenticating API clients");
    const adminClient = new CookieClient();
    const buyerClient = new CookieClient();
    const sellerClientOne = new CookieClient();
    const sellerClientTwo = new CookieClient();

    await loginAdmin(adminClient);
    await login(buyerClient, buyer.email, buyer.password, "buyer login");
    await login(sellerClientOne, sellerOne.email, sellerOne.password, "seller one login");
    await login(sellerClientTwo, sellerTwo.email, sellerTwo.password, "seller two login");

    const sellerClientsByStoreId = new Map<number, CookieClient>([
      [storeOne.id, sellerClientOne],
      [storeTwo.id, sellerClientTwo],
    ]);

    logStep("seller shipping setup route exposes canonical read/update flow");
    const ownSetupResponse = await getSellerStoreProfile(sellerClientOne, storeOne.id);
    assertStatus(ownSetupResponse, 200, "seller own store-profile read");
    assert.equal(
      String(ownSetupResponse.body?.data?.shippingSetupStatus?.code || ""),
      "READY",
      "seller own store-profile should expose READY shipping setup"
    );
    assert.equal(
      Boolean(ownSetupResponse.body?.data?.isShippingReady),
      true,
      "seller own store-profile should expose ready shipping setup"
    );

    const disableSetupResponse = await patchSellerStoreProfile(sellerClientOne, storeOne.id, {
      shippingSetup: {
        shippingEnabled: false,
        pickupNotes: "Disabled during seller shipping setup smoke.",
      },
    });
    assertStatus(disableSetupResponse, 200, "seller own store-profile disable shipping");
    assert.equal(
      String(disableSetupResponse.body?.data?.shippingSetupStatus?.code || ""),
      "DISABLED",
      "seller should be able to disable store shipping setup"
    );
    assert.equal(
      Boolean(disableSetupResponse.body?.data?.isShippingReady),
      false,
      "disabled store shipping setup should not be ready"
    );

    const reenableSetupResponse = await patchSellerStoreProfile(sellerClientOne, storeOne.id, {
      shippingSetup: {
        shippingEnabled: true,
        originContactName: "Shipment Smoke Sender",
        pickupNotes: "Ready again for shipment smoke verification.",
      },
    });
    assertStatus(reenableSetupResponse, 200, "seller own store-profile re-enable shipping");
    assert.equal(
      String(reenableSetupResponse.body?.data?.shippingSetupStatus?.code || ""),
      "READY",
      "seller should be able to restore ready shipping setup"
    );
    assert.equal(
      String(reenableSetupResponse.body?.data?.shippingSetup?.originContactName || ""),
      "Shipment Smoke Sender"
    );
    assert.equal(
      Boolean(reenableSetupResponse.body?.data?.isShippingReady),
      true,
      "re-enabled shipping setup should become ready again"
    );

    const forbiddenSetupResponse = await patchSellerStoreProfile(sellerClientTwo, storeOne.id, {
      shippingSetup: {
        pickupNotes: "Illegal cross-store edit attempt.",
      },
    });
    assertStatus(forbiddenSetupResponse, 403, "seller cross-store profile patch");
    assert.equal(
      String(forbiddenSetupResponse.body?.code || ""),
      "SELLER_FORBIDDEN",
      "seller should not be able to update another store shipping setup"
    );
    const contextResponse = await getSellerWorkspaceContext(sellerClientOne, storeOne.id);
    assertStatus(contextResponse, 200, "seller workspace context with shipping setup");
    assert.equal(
      String(contextResponse.body?.data?.store?.shippingSetupStatus?.code || ""),
      "READY",
      "seller workspace context should expose canonical shipping setup status"
    );
    logPass("seller shipping setup read/update/store scoping");

    let legacyOrderId = 0;

    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "false",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "false",
      },
      async () => {
        logStep("feature OFF keeps persisted shipment lane hidden");
        const legacyScenario = await createMultiStoreOrder({
          buyerClient,
          buyerUserId: buyer.id,
          products: [productOne],
          label: "feature-off",
        });
        legacyOrderId = legacyScenario.orderId;
        const persistedCount = await Shipment.count({
          where: { orderId: legacyScenario.orderId } as any,
        });
        assert.equal(persistedCount, 0, "feature OFF should not persist shipment records");

        const suborders = await loadOrderSuborders(legacyScenario.orderId);
        const readModel = buildOrderShippingReadModel(suborders);
        assert.equal(readModel.shipmentCount, 0, "feature OFF should hide shipment count");
        assert.equal(Array.isArray(readModel.shipments) ? readModel.shipments.length : 0, 0);
        logPass("feature OFF legacy fallback");
      }
    );

    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "true",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "false",
      },
      async () => {
        logStep("MVP ON + mutation OFF persists shipment records and keeps actions blocked");
        const scenario = await createMultiStoreOrder({
          buyerClient,
          buyerUserId: buyer.id,
          products: [productOne, productTwo],
          label: "mutation-off",
        });

        const persistedShipments = await Shipment.findAll({
          where: { orderId: scenario.orderId } as any,
          include: [{ model: TrackingEvent, as: "trackingEvents", required: false }],
          order: [["id", "ASC"]],
        });
        assert.equal(
          persistedShipments.length,
          2,
          "new multi-store order should persist two shipments"
        );
        persistedShipments.forEach((shipment: any) => {
          assert.equal(String(shipment.getDataValue("status")), "WAITING_PAYMENT");
          const trackingEvents = Array.isArray(shipment.trackingEvents)
            ? shipment.trackingEvents
            : [];
          assert.equal(trackingEvents.length, 1, "shipment should start with one tracking event");
          assert.equal(
            String(
              trackingEvents[0]?.getDataValue?.("eventType") || trackingEvents[0]?.eventType
            ),
            "WAITING_PAYMENT"
          );
        });

        await approveAllGroupPayments(scenario, buyerClient, sellerClientsByStoreId);
        const suborders = await loadOrderSuborders(scenario.orderId);
        const readModel = buildOrderShippingReadModel(suborders);
        assert.equal(readModel.shipmentCount, 2, "persisted-first read model should expose shipments");
        assert.equal(
          readModel.shipments.every((shipment: any) => shipment.usedLegacyFallback === false),
          true
        );
        assert.equal(
          readModel.shipments.every(
            (shipment: any) =>
              Array.isArray(shipment.availableShippingActions) &&
              shipment.availableShippingActions.every((action: any) => action?.enabled === false)
          ),
          true,
          "mutation OFF should keep all shipment actions disabled"
        );

        const mutationResponse = await mutateSellerFulfillment({
          client: sellerClientOne,
          storeId: storeOne.id,
          suborderId: scenario.groups.find((group) => group.storeId === storeOne.id)!.suborderId,
          action: "MARK_PROCESSING",
          expectedStatus: 409,
        });
        assert.equal(
          String(mutationResponse.body?.code || "").toUpperCase(),
          "SHIPMENT_MUTATION_DISABLED",
          "mutation OFF should short-circuit to shipment disabled guard"
        );
        const sellerSubordersResponse = await getSellerSubordersList(sellerClientOne, storeOne.id);
        assertStatus(sellerSubordersResponse, 200, "seller suborders list with shipping setup");
        assert.equal(
          String(
            sellerSubordersResponse.body?.data?.storeShippingSetup?.shippingSetupStatus?.code || ""
          ),
          "READY",
          "seller suborders list should expose top-level store shipping setup status"
        );
        logPass("mutation OFF persisted shipment guard");
      }
    );

    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "true",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "true",
      },
      async () => {
        logStep(
          "MVP ON + mutation ON syncs shipment status, tracking events, and compatibility storage"
        );
        const scenario = await createMultiStoreOrder({
          buyerClient,
          buyerUserId: buyer.id,
          products: [productOne, productTwo],
          label: "mutation-on",
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
          trackingNumber: "JNE-SMOKE-001",
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
          trackingNumber: "JNT-SMOKE-002",
        });
        await mutateSellerFulfillment({
          client: sellerClientTwo,
          storeId: storeTwo.id,
          suborderId: groupTwo.suborderId,
          action: "MARK_DELIVERED",
        });

        const shippedSuborders = await loadOrderSuborders(scenario.orderId);
        const readModel = buildOrderShippingReadModel(shippedSuborders);
        assert.equal(readModel.shipmentCount, 2, "mutation ON should keep both shipments visible");

        const shippedShipment = readModel.shipments.find(
          (shipment: any) => shipment.storeId === storeOne.id
        );
        const deliveredShipment = readModel.shipments.find(
          (shipment: any) => shipment.storeId === storeTwo.id
        );
        assert.equal(shippedShipment?.shipmentStatus, "SHIPPED");
        assert.equal(deliveredShipment?.shipmentStatus, "DELIVERED");
        assert.equal(shippedShipment?.trackingNumber, "JNE-SMOKE-001");
        assert.equal(deliveredShipment?.trackingNumber, "JNT-SMOKE-002");

        const storedSuborders = await Suborder.findAll({
          where: { id: { [Op.in]: [groupOne.suborderId, groupTwo.suborderId] } } as any,
          order: [["id", "ASC"]],
        });
        const shippedStoreSplit = storedSuborders.find(
          (suborder: any) => toNumber(suborder.getDataValue("storeId"), 0) === storeOne.id
        );
        const deliveredStoreSplit = storedSuborders.find(
          (suborder: any) => toNumber(suborder.getDataValue("storeId"), 0) === storeTwo.id
        );
        assert.equal(String(shippedStoreSplit?.getDataValue("fulfillmentStatus") || ""), "SHIPPED");
        assert.equal(
          String(deliveredStoreSplit?.getDataValue("fulfillmentStatus") || ""),
          "DELIVERED"
        );

        const shipmentRows = await Shipment.findAll({
          where: { orderId: scenario.orderId } as any,
          include: [{ model: TrackingEvent, as: "trackingEvents", required: false }],
        });
        const deliveredRow: any = shipmentRows.find(
          (shipment: any) => toNumber(shipment.getDataValue("storeId"), 0) === storeTwo.id
        );
        const eventTypes = (
          Array.isArray(deliveredRow?.trackingEvents) ? deliveredRow.trackingEvents : []
        )
          .map((event: any) => String(event?.getDataValue?.("eventType") || event?.eventType || ""))
          .filter(Boolean);
        assert.equal(eventTypes[0], "WAITING_PAYMENT");
        assert.equal(eventTypes.includes("READY_TO_FULFILL"), true);
        assert.equal(eventTypes.includes("SHIPPED"), true);
        assert.equal(eventTypes[eventTypes.length - 1], "DELIVERED");
        logPass("mutation ON shipment sync and tracking timeline");
      }
    );

    await withEnv(
      {
        ENABLE_MULTISTORE_SHIPMENT_MVP: "true",
        ENABLE_MULTISTORE_SHIPMENT_MUTATION: "false",
      },
      async () => {
        logStep("legacy order remains readable through persisted-first fallback");
        const suborders = await loadOrderSuborders(legacyOrderId);
        const readModel = buildOrderShippingReadModel(suborders);
        assert.equal(readModel.usedLegacyFallback, true, "legacy order should remain readable via fallback");
        assert.equal(
          readModel.shipmentCount >= 1,
          true,
          "legacy fallback should synthesize shipment summary"
        );
        assert.equal(
          readModel.shipments.every((shipment: any) => shipment.usedLegacyFallback === true),
          true
        );
        logPass("legacy order fallback with MVP enabled");
      }
    );

    console.log("[shipment-regression] OK");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error: Error | undefined) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

run()
  .catch((error) => {
    console.error("[shipment-regression] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[shipment-regression] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
