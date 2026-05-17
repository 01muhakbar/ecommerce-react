import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
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
  User,
  sequelize,
} from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-seller-ownership-${Date.now()}`;

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
  storeId: number;
  suborderId: number;
  paymentId: number;
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

const logStep = (label: string) => {
  console.log(`[mvf-seller-ownership] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-seller-ownership] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(
    response.ok,
    true,
    `[mvf-seller-ownership] API not ready at ${BASE_URL}/api/health`
  );
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

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = slugify(`${RUN_ID}-${label}`);
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID}-${label}`,
    slug,
    status: "ACTIVE",
    phone: "081234567890",
    addressLine1: "MVF Origin Street 1",
    city: "Jakarta Selatan",
    province: "Jakarta",
    postalCode: "12190",
    country: "Indonesia",
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
    accountName: `MVF Account ${storeId}`,
    merchantName: `MVF Merchant ${storeId}`,
    merchantId: `MVF-${storeId}`,
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
  await Store.update(
    { activeStorePaymentProfileId: id } as any,
    { where: { id: storeId } as any }
  );
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
    stock: 30,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
    promoImagePath: "/uploads/products/demo.svg",
    imagePaths: ["/uploads/products/demo.svg"],
    variations: {
      hasVariants: false,
      variants: [],
    },
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id, slug };
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

function buildShippingDetails(label: string) {
  return {
    fullName: `MVF ${label}`,
    phoneNumber: "081234567890",
    province: "Jakarta",
    city: "Jakarta Selatan",
    district: "Kebayoran Baru",
    postalCode: "12190",
    streetName: "MVF Street",
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

async function createCheckoutOrder(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  label: string;
  storeId: number;
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
        notes: `Smoke ${input.label}`,
      },
      shippingDetails,
    }),
  });
  assertStatus(response, 201, `${input.label} create checkout`);
  assert.equal(Boolean(response.body?.success), true, `${input.label}: checkout did not return success`);
  const data = response.body?.data ?? null;
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  assert.equal(groups.length, 1, `${input.label}: expected one checkout group`);
  assert.equal(toNumber(groups[0]?.storeId, 0), input.storeId, `${input.label}: storeId mismatch`);
  const orderId = toNumber(data?.orderId, 0);
  const suborderId = toNumber(groups[0]?.suborderId, 0);
  const paymentId = toNumber(groups[0]?.payment?.id, 0);
  assert.ok(orderId > 0, `${input.label}: orderId missing`);
  assert.ok(suborderId > 0, `${input.label}: suborderId missing`);
  assert.ok(paymentId > 0, `${input.label}: paymentId missing`);
  createdOrderIds.push(orderId);
  return {
    orderId,
    invoiceNo: String(data?.invoiceNo || data?.ref || orderId),
    storeId: input.storeId,
    suborderId,
    paymentId,
  };
}

async function createPendingProof(input: {
  scenario: CheckoutScenario;
  buyerUserId: number;
}) {
  const now = new Date();
  await Payment.update(
    { status: "PENDING_CONFIRMATION" } as any,
    { where: { id: input.scenario.paymentId } as any }
  );
  await Suborder.update(
    { paymentStatus: "PENDING_CONFIRMATION" } as any,
    { where: { id: input.scenario.suborderId } as any }
  );
  await Order.update(
    { paymentStatus: "PENDING_CONFIRMATION" } as any,
    { where: { id: input.scenario.orderId } as any }
  );
  await PaymentProof.create({
    paymentId: input.scenario.paymentId,
    uploadedByUserId: input.buyerUserId,
    proofImageUrl: `https://example.com/${RUN_ID}-${input.scenario.paymentId}.png`,
    senderName: `Buyer ${input.buyerUserId}`,
    senderBankOrWallet: "Smoke Bank",
    transferAmount: 125000,
    transferTime: now,
    note: "Smoke pending proof",
    reviewStatus: "PENDING",
  } as any);
}

const extractSuborderIds = (response: JsonResponse) => {
  const items = Array.isArray(response.body?.data?.items) ? response.body.data.items : [];
  return items.map((item: any) => toNumber(item?.suborderId, 0)).filter((id: number) => id > 0);
};

async function cleanupFixtures() {
  if (createdOrderIds.length > 0) {
    const payments = await Payment.findAll({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      attributes: ["id"],
    }).catch(() => []);
    const paymentIds = payments
      .map((payment: any) => Number(payment.getDataValue?.("id") || 0))
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
      await Payment.destroy({
        where: { id: { [Op.in]: paymentIds } } as any,
        force: true,
      }).catch(() => null);
    }

    await Shipment.destroy({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      force: true,
    }).catch(() => null);
    const suborders = await Suborder.findAll({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      attributes: ["id"],
    }).catch(() => []);
    const suborderIds = suborders
      .map((suborder: any) => Number(suborder.getDataValue?.("id") || 0))
      .filter((id: number) => id > 0);
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

  if (createdUserIds.length > 0) {
    const carts = await Cart.findAll({
      where: { userId: { [Op.in]: createdUserIds } } as any,
      attributes: ["id"],
    }).catch(() => []);
    const cartIds = carts
      .map((cart: any) => Number(cart.getDataValue?.("id") || 0))
      .filter((id: number) => id > 0);
    if (cartIds.length > 0) {
      await CartItem.destroy({
        where: { cartId: { [Op.in]: cartIds } } as any,
        force: true,
      }).catch(() => null);
      await Cart.destroy({
        where: { id: { [Op.in]: cartIds } } as any,
        force: true,
      }).catch(() => null);
    }
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
  await ensureServerReady();
  await sequelize.authenticate();

  logStep("creating two seller stores, buyers, products, and orders");
  const sellerA = await createFixtureUser("seller-a");
  const sellerB = await createFixtureUser("seller-b");
  const buyerA = await createFixtureUser("buyer-a");
  const buyerB = await createFixtureUser("buyer-b");
  const storeA = await createFixtureStore(sellerA.id, "store-a");
  const storeB = await createFixtureStore(sellerB.id, "store-b");
  await createFixturePaymentProfile(storeA.id);
  await createFixturePaymentProfile(storeB.id);
  const productA = await createFixtureProduct({
    ownerUserId: sellerA.id,
    storeId: storeA.id,
    label: "product-a",
  });
  const productB = await createFixtureProduct({
    ownerUserId: sellerB.id,
    storeId: storeB.id,
    label: "product-b",
  });

  const sellerAClient = new CookieClient();
  const sellerBClient = new CookieClient();
  const buyerAClient = new CookieClient();
  const buyerBClient = new CookieClient();
  const adminClient = new CookieClient();
  await login(sellerAClient, sellerA.email, sellerA.password, "seller A login");
  await login(sellerBClient, sellerB.email, sellerB.password, "seller B login");
  await login(buyerAClient, buyerA.email, buyerA.password, "buyer A login");
  await login(buyerBClient, buyerB.email, buyerB.password, "buyer B login");
  await loginAdmin(adminClient);

  const orderA = await createCheckoutOrder({
    customerClient: buyerAClient,
    buyerUserId: buyerA.id,
    productId: productA.id,
    label: "order-a",
    storeId: storeA.id,
  });
  const orderB = await createCheckoutOrder({
    customerClient: buyerBClient,
    buyerUserId: buyerB.id,
    productId: productB.id,
    label: "order-b",
    storeId: storeB.id,
  });
  await createPendingProof({ scenario: orderA, buyerUserId: buyerA.id });
  await createPendingProof({ scenario: orderB, buyerUserId: buyerB.id });
  logPass("fixtures created through checkout with isolated store scopes");

  logStep("checking seller list and detail isolation");
  const sellerAList = await sellerAClient.request(`/api/seller/stores/${storeA.id}/suborders`);
  assertStatus(sellerAList, 200, "seller A list own store");
  assert.ok(extractSuborderIds(sellerAList).includes(orderA.suborderId), "seller A list should include own suborder");
  assert.ok(!extractSuborderIds(sellerAList).includes(orderB.suborderId), "seller A list must not include seller B suborder");

  const sellerBList = await sellerBClient.request(`/api/seller/stores/${storeB.id}/suborders`);
  assertStatus(sellerBList, 200, "seller B list own store");
  assert.ok(extractSuborderIds(sellerBList).includes(orderB.suborderId), "seller B list should include own suborder");
  assert.ok(!extractSuborderIds(sellerBList).includes(orderA.suborderId), "seller B list must not include seller A suborder");

  assertStatus(
    await sellerAClient.request(`/api/seller/stores/${storeA.id}/suborders/${orderA.suborderId}`),
    200,
    "seller A detail own suborder"
  );
  assertStatus(
    await sellerAClient.request(`/api/seller/stores/${storeA.id}/suborders/${orderB.suborderId}`),
    404,
    "seller A detail seller B suborder through own store"
  );
  assertStatus(
    await sellerAClient.request(`/api/seller/stores/${storeB.id}/suborders/${orderB.suborderId}`),
    403,
    "seller A detail seller B suborder through seller B store"
  );
  assertStatus(
    await sellerBClient.request(`/api/seller/stores/${storeB.id}/suborders/${orderA.suborderId}`),
    404,
    "seller B detail seller A suborder through own store"
  );
  assertStatus(
    await sellerBClient.request(`/api/seller/stores/${storeA.id}/suborders/${orderA.suborderId}`),
    403,
    "seller B detail seller A suborder through seller A store"
  );
  logPass("seller suborder list/detail is store-scoped");

  logStep("checking seller payment review isolation");
  const sellerAPaymentList = await sellerAClient.request(
    `/api/seller/stores/${storeA.id}/payment-review/suborders`
  );
  assertStatus(sellerAPaymentList, 200, "seller A payment review list");
  assert.ok(
    extractSuborderIds(sellerAPaymentList).includes(orderA.suborderId),
    "seller A payment list should include own suborder"
  );
  assert.ok(
    !extractSuborderIds(sellerAPaymentList).includes(orderB.suborderId),
    "seller A payment list must not include seller B suborder"
  );
  assertStatus(
    await sellerAClient.request(`/api/seller/stores/${storeA.id}/payments/${orderB.paymentId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action: "APPROVE", note: "cross-store attempt" }),
    }),
    404,
    "seller A route-scoped review seller B payment"
  );
  assertStatus(
    await sellerAClient.request(`/api/seller/payments/${orderB.paymentId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ action: "APPROVE", note: "legacy cross-store attempt" }),
    }),
    403,
    "seller A legacy review seller B payment"
  );
  const sellerAReviewOwn = await sellerAClient.request(
    `/api/seller/stores/${storeA.id}/payments/${orderA.paymentId}/review`,
    {
      method: "PATCH",
      body: JSON.stringify({ action: "APPROVE", note: "own payment approval" }),
    }
  );
  assertStatus(sellerAReviewOwn, 200, "seller A review own payment");
  logPass("seller payment review mutation is isolated by store");

  logStep("checking seller fulfillment mutation isolation");
  const sellerAFulfillOwn = await sellerAClient.request(
    `/api/seller/stores/${storeA.id}/suborders/${orderA.suborderId}/fulfillment`,
    {
      method: "PATCH",
      body: JSON.stringify({ action: "MARK_PROCESSING" }),
    }
  );
  assertStatus(sellerAFulfillOwn, 200, "seller A fulfill own paid suborder");
  assertStatus(
    await sellerAClient.request(
      `/api/seller/stores/${storeA.id}/suborders/${orderB.suborderId}/fulfillment`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "MARK_PROCESSING" }),
      }
    ),
    404,
    "seller A fulfill seller B suborder through own store"
  );
  assertStatus(
    await sellerAClient.request(
      `/api/seller/stores/${storeB.id}/suborders/${orderB.suborderId}/fulfillment`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "MARK_PROCESSING" }),
      }
    ),
    403,
    "seller A fulfill seller B suborder through seller B store"
  );
  assertStatus(
    await sellerBClient.request(
      `/api/seller/stores/${storeA.id}/suborders/${orderA.suborderId}/fulfillment`,
      {
        method: "PATCH",
        body: JSON.stringify({ action: "MARK_SHIPPED" }),
      }
    ),
    403,
    "seller B fulfill seller A suborder through seller A store"
  );
  logPass("seller fulfillment mutation is store-scoped");

  logStep("checking admin and client ownership lanes remain intact");
  assertStatus(
    await adminClient.request(`/api/admin/orders/by-invoice/${encodeURIComponent(orderA.invoiceNo)}`),
    200,
    "admin reads order A"
  );
  assertStatus(
    await adminClient.request(`/api/admin/orders/by-invoice/${encodeURIComponent(orderB.invoiceNo)}`),
    200,
    "admin reads order B"
  );
  assertStatus(
    await buyerAClient.request(`/api/store/orders/my/${orderA.orderId}`),
    200,
    "buyer A reads own order"
  );
  assertStatus(
    await buyerAClient.request(`/api/store/orders/my/${orderB.orderId}`),
    404,
    "buyer A cannot read buyer B order"
  );
  assertStatus(
    await buyerBClient.request(`/api/store/orders/my/${orderB.orderId}`),
    200,
    "buyer B reads own order"
  );
  logPass("admin full read and client ownership lanes remain intact");

  console.log("[mvf-seller-ownership] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-seller-ownership] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-seller-ownership] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
