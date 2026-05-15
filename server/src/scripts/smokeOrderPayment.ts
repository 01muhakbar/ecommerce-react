import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import {
  Cart,
  CartItem,
  Notification,
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
const RUN_ID = `mvf3-order-${Date.now()}`;

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
  console.log(`[mvf-order-payment] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-order-payment] PASS ${label}`);
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
    `[mvf-order-payment] API not ready at ${BASE_URL}/api/health`
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

function getSingleGroup(data: any, label: string) {
  const groups = Array.isArray(data?.groups) ? data.groups : [];
  assert.equal(groups.length, 1, `${label}: expected exactly one checkout group`);
  return groups[0];
}

function assertInitialState(data: any, label: string) {
  assert.equal(String(data?.checkoutMode || ""), "SINGLE_STORE", `${label}: checkoutMode mismatch`);
  assert.equal(String(data?.paymentStatus || ""), "UNPAID", `${label}: parent paymentStatus mismatch`);
  assert.equal(String(data?.orderStatus || ""), "pending", `${label}: parent orderStatus mismatch`);

  const group = getSingleGroup(data, label);
  assert.equal(String(group?.paymentStatus || ""), "UNPAID", `${label}: suborder paymentStatus mismatch`);
  assert.equal(
    String(group?.fulfillmentStatus || ""),
    "UNFULFILLED",
    `${label}: fulfillmentStatus mismatch`
  );
  assert.ok(group?.payment?.id, `${label}: payment record missing`);
  assert.equal(String(group?.payment?.status || ""), "CREATED", `${label}: payment record should start CREATED`);
  assert.equal(
    String(group?.paymentReadModel?.status || ""),
    "CREATED",
    `${label}: paymentReadModel status should start CREATED`
  );
  assert.equal(
    Boolean(group?.paymentReadModel?.proofActionability?.canStartProof),
    true,
    `${label}: paymentReadModel proofActionability should start actionable`
  );
  assert.equal(
    Boolean(group?.payment?.readModel?.cancelability?.canCancel),
    true,
    `${label}: nested payment readModel cancelability should start actionable`
  );
  assert.equal(
    String(data?.paymentEntry?.summaryStatus || ""),
    "ACTION_REQUIRED",
    `${label}: paymentEntry should start actionable`
  );
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
  couponCode?: string;
  checkoutRequestKey?: string;
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
      couponCode: input.couponCode,
      checkoutRequestKey: input.checkoutRequestKey,
      shippingDetails,
    }),
  });
  assertStatus(response, 201, `${input.label} create checkout`);
  assert.equal(Boolean(response.body?.success), true, `${input.label}: checkout did not return success`);
  const data = response.body?.data ?? null;
  assertInitialState(data, `${input.label} initial response`);
  const group = getSingleGroup(data, `${input.label} initial response`);
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
    storeId: input.storeId,
    suborderId,
    paymentId,
  };
}

async function runCheckoutIdempotencyScenario(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  storeId: number;
}) {
  logStep("idempotency scenario: duplicate checkout request reuses existing order");
  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  const shippingDetails = buildShippingDetails("idempotency");
  const checkoutRequestKey = `${RUN_ID}:checkout-idempotency`;
  const checkoutBody = {
    customer: {
      name: shippingDetails.fullName,
      phone: shippingDetails.phoneNumber,
      address: `${shippingDetails.streetName} ${shippingDetails.houseNumber}`,
      notes: "Smoke idempotency",
    },
    checkoutRequestKey,
    shippingDetails,
  };

  const first = await input.customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify(checkoutBody),
  });
  assertStatus(first, 201, "idempotency first checkout");
  assert.equal(Boolean(first.body?.success), true, "idempotency first checkout: missing success");
  const firstData = first.body?.data ?? null;
  assertInitialState(firstData, "idempotency first checkout");
  const firstGroup = getSingleGroup(firstData, "idempotency first checkout");
  const orderId = toNumber(firstData?.orderId, 0);
  const suborderId = toNumber(firstGroup?.suborderId, 0);
  const paymentId = toNumber(firstGroup?.payment?.id, 0);
  const invoiceNo = String(firstData?.invoiceNo || firstData?.ref || "");
  const suborderNumber = String(firstGroup?.suborderNumber || "");
  assert.ok(orderId > 0, "idempotency first checkout: orderId missing");
  assert.ok(suborderId > 0, "idempotency first checkout: suborderId missing");
  assert.ok(paymentId > 0, "idempotency first checkout: paymentId missing");
  assert.ok(invoiceNo, "idempotency first checkout: invoiceNo missing");
  assert.ok(suborderNumber, "idempotency first checkout: suborderNumber missing");
  assert.equal(
    toNumber(firstGroup?.storeId, 0),
    input.storeId,
    "idempotency first checkout: storeId mismatch"
  );
  createdOrderIds.push(orderId);

  const replay = await input.customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify(checkoutBody),
  });
  assertStatus(replay, 200, "idempotency replay checkout");
  assert.equal(Boolean(replay.body?.success), true, "idempotency replay checkout: missing success");
  assert.equal(
    Boolean(replay.body?.data?.idempotency?.replayed),
    true,
    "idempotency replay checkout: replay flag missing"
  );
  assert.equal(
    toNumber(replay.body?.data?.orderId, 0),
    orderId,
    "idempotency replay checkout: orderId mismatch"
  );
  assert.equal(
    String(replay.body?.data?.invoiceNo || replay.body?.data?.ref || ""),
    invoiceNo,
    "idempotency replay checkout: invoiceNo mismatch"
  );
  const replayGroup = getSingleGroup(replay.body?.data, "idempotency replay checkout");
  assert.equal(
    toNumber(replayGroup?.suborderId, 0),
    suborderId,
    "idempotency replay checkout: suborderId mismatch"
  );
  assert.equal(
    toNumber(replayGroup?.payment?.id, 0),
    paymentId,
    "idempotency replay checkout: paymentId mismatch"
  );

  const headerReplay = await input.customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    headers: {
      "Idempotency-Key": checkoutRequestKey,
    },
    body: JSON.stringify({
      customer: checkoutBody.customer,
      shippingDetails,
    }),
  });
  assertStatus(headerReplay, 200, "idempotency header replay checkout");
  assert.equal(
    Boolean(headerReplay.body?.data?.idempotency?.replayed),
    true,
    "idempotency header replay checkout: replay flag missing"
  );
  assert.equal(
    toNumber(headerReplay.body?.data?.orderId, 0),
    orderId,
    "idempotency header replay checkout: orderId mismatch"
  );

  const orders = await Order.findAll({
    where: { invoiceNo } as any,
    attributes: ["id"],
  });
  assert.equal(orders.length, 1, "idempotency checkout: duplicate parent order created");

  const suborders = await Suborder.findAll({
    where: { orderId } as any,
    attributes: ["id"],
  });
  assert.equal(suborders.length, 1, "idempotency checkout: duplicate suborder created");

  const payments = await Payment.findAll({
    where: { suborderId } as any,
    attributes: ["id"],
  });
  assert.equal(payments.length, 1, "idempotency checkout: duplicate payment created");

  const createdPaymentLog = await PaymentStatusLog.findOne({
    where: {
      paymentId,
      newStatus: "CREATED",
    } as any,
    attributes: ["id", "note"],
  });
  assert.ok(createdPaymentLog, "idempotency checkout: payment creation audit log missing");
  const createdPaymentLogNote = String((createdPaymentLog as any)?.note || "");
  assert.ok(
    createdPaymentLogNote.includes("source=checkout:create-multi-store"),
    "idempotency checkout: payment creation audit source missing"
  );
  assert.ok(
    createdPaymentLogNote.includes(`invoiceNo=${invoiceNo}`),
    "idempotency checkout: payment creation audit invoice missing"
  );

  const sellerNotificationCount = await Notification.count({
    where: {
      type: "SELLER_SUBORDER_CREATED",
      title: `New suborder ${suborderNumber} is awaiting buyer payment`,
    } as any,
  });
  assert.equal(
    sellerNotificationCount,
    1,
    "idempotency checkout: duplicate seller notification created"
  );

  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  const parallelShippingDetails = buildShippingDetails("idempotency-parallel");
  const parallelCheckoutRequestKey = `${RUN_ID}:checkout-idempotency-parallel`;
  const parallelCheckoutBody = {
    customer: {
      name: parallelShippingDetails.fullName,
      phone: parallelShippingDetails.phoneNumber,
      address: `${parallelShippingDetails.streetName} ${parallelShippingDetails.houseNumber}`,
      notes: "Smoke parallel idempotency",
    },
    checkoutRequestKey: parallelCheckoutRequestKey,
    shippingDetails: parallelShippingDetails,
  };
  const parallelResponses = await Promise.all([
    input.customerClient.request("/api/checkout/create-multi-store", {
      method: "POST",
      body: JSON.stringify(parallelCheckoutBody),
    }),
    input.customerClient.request("/api/checkout/create-multi-store", {
      method: "POST",
      body: JSON.stringify(parallelCheckoutBody),
    }),
  ]);
  const parallelSuccessResponses = parallelResponses.filter((response) =>
    response.status === 201 || response.status === 200
  );
  assert.ok(
    parallelSuccessResponses.length >= 1,
    `parallel idempotency checkout: expected a canonical response, received ${parallelResponses
      .map((response) => `${response.status}:${response.text}`)
      .join(" | ")}`
  );
  for (const response of parallelResponses) {
    const isCanonical = response.status === 201 || response.status === 200;
    const isInProgress =
      response.status === 409 &&
      String(response.body?.code || "") === "CHECKOUT_IDEMPOTENCY_IN_PROGRESS" &&
      Boolean(response.body?.data?.retryable);
    assert.ok(
      isCanonical || isInProgress,
      `parallel idempotency checkout: unsafe duplicate response ${response.status} ${response.text}`
    );
  }

  const parallelCanonical = parallelSuccessResponses[0].body?.data ?? null;
  const parallelOrderId = toNumber(parallelCanonical?.orderId, 0);
  const parallelInvoiceNo = String(parallelCanonical?.invoiceNo || parallelCanonical?.ref || "");
  assert.ok(parallelOrderId > 0, "parallel idempotency checkout: orderId missing");
  assert.ok(parallelInvoiceNo, "parallel idempotency checkout: invoiceNo missing");
  const parallelGroup = getSingleGroup(
    parallelCanonical,
    "parallel idempotency canonical checkout"
  );
  const parallelSuborderId = toNumber(parallelGroup?.suborderId, 0);
  const parallelPaymentId = toNumber(parallelGroup?.payment?.id, 0);
  assert.ok(parallelSuborderId > 0, "parallel idempotency checkout: suborderId missing");
  assert.ok(parallelPaymentId > 0, "parallel idempotency checkout: paymentId missing");
  if (!createdOrderIds.includes(parallelOrderId)) {
    createdOrderIds.push(parallelOrderId);
  }
  for (const response of parallelSuccessResponses.slice(1)) {
    assert.equal(
      toNumber(response.body?.data?.orderId, 0),
      parallelOrderId,
      "parallel idempotency checkout: duplicate response orderId mismatch"
    );
    assert.equal(
      String(response.body?.data?.invoiceNo || response.body?.data?.ref || ""),
      parallelInvoiceNo,
      "parallel idempotency checkout: duplicate response invoiceNo mismatch"
    );
  }

  const parallelReplay = await input.customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify(parallelCheckoutBody),
  });
  assertStatus(parallelReplay, 200, "parallel idempotency replay checkout");
  assert.equal(
    Boolean(parallelReplay.body?.data?.idempotency?.replayed),
    true,
    "parallel idempotency replay checkout: replay flag missing"
  );
  assert.equal(
    toNumber(parallelReplay.body?.data?.orderId, 0),
    parallelOrderId,
    "parallel idempotency replay checkout: orderId mismatch"
  );

  const parallelOrders = await Order.findAll({
    where: { invoiceNo: parallelInvoiceNo } as any,
    attributes: ["id"],
  });
  assert.equal(
    parallelOrders.length,
    1,
    "parallel idempotency checkout: duplicate parent order created"
  );

  const parallelSuborders = await Suborder.findAll({
    where: { orderId: parallelOrderId } as any,
    attributes: ["id"],
  });
  assert.equal(
    parallelSuborders.length,
    1,
    "parallel idempotency checkout: duplicate suborder created"
  );

  const parallelPayments = await Payment.findAll({
    where: { suborderId: parallelSuborderId } as any,
    attributes: ["id"],
  });
  assert.equal(
    parallelPayments.length,
    1,
    "parallel idempotency checkout: duplicate payment created"
  );

  logPass("checkout idempotency duplicate-submit coverage");
}

async function fetchBuyerGroupedOrder(customerClient: CookieClient, orderId: number, label: string) {
  const response = await customerClient.request(`/api/orders/${orderId}/checkout-payment`);
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: buyer grouped view missing success`);
  return response.body?.data ?? null;
}

async function fetchPaymentDetail(customerClient: CookieClient, paymentId: number, label: string) {
  const response = await customerClient.request(`/api/payments/${paymentId}`);
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: payment detail missing success`);
  return response.body?.data ?? null;
}

async function fetchSellerOrderDetail(
  sellerClient: CookieClient,
  storeId: number,
  suborderId: number,
  label: string
) {
  const response = await sellerClient.request(
    `/api/seller/stores/${storeId}/suborders/${suborderId}`
  );
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: seller order detail missing success`);
  return response.body?.data ?? null;
}

async function expectSellerFulfillmentBlocked(input: {
  sellerClient: CookieClient;
  storeId: number;
  suborderId: number;
  action: "MARK_PROCESSING" | "MARK_SHIPPED" | "MARK_DELIVERED";
  expectedCode: string;
  label: string;
  body?: Record<string, unknown>;
}) {
  const response = await input.sellerClient.request(
    `/api/seller/stores/${input.storeId}/suborders/${input.suborderId}/fulfillment`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: input.action,
        ...(input.body || {}),
      }),
    }
  );
  assertStatus(response, 409, input.label);
  assert.equal(Boolean(response.body?.success), false, `${input.label}: mutation should fail`);
  assert.equal(
    String(response.body?.code || ""),
    input.expectedCode,
    `${input.label}: blocker code mismatch`
  );
  return response.body ?? null;
}

async function updateSellerFulfillment(input: {
  sellerClient: CookieClient;
  storeId: number;
  suborderId: number;
  action: "MARK_PROCESSING" | "MARK_SHIPPED" | "MARK_DELIVERED";
  label: string;
  trackingNumber?: string;
  courierCode?: string;
  courierService?: string;
}) {
  const response = await input.sellerClient.request(
    `/api/seller/stores/${input.storeId}/suborders/${input.suborderId}/fulfillment`,
    {
      method: "PATCH",
      body: JSON.stringify({
        action: input.action,
        trackingNumber: input.trackingNumber,
        courierCode: input.courierCode,
        courierService: input.courierService,
      }),
    }
  );
  assertStatus(response, 200, input.label);
  assert.equal(Boolean(response.body?.success), true, `${input.label}: mutation should succeed`);
  return response.body?.data ?? null;
}

async function fetchSellerPaymentReviewList(
  sellerClient: CookieClient,
  storeId: number,
  paymentStatus: string,
  label: string
) {
  const response = await sellerClient.request(
    `/api/seller/stores/${storeId}/payment-review/suborders?paymentStatus=${encodeURIComponent(
      paymentStatus
    )}`
  );
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: seller payment review missing success`);
  return response.body?.data ?? null;
}

async function fetchAdminAuditDetail(adminClient: CookieClient, orderId: number, label: string) {
  const response = await adminClient.request(`/api/admin/payments/audit/${orderId}`);
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: admin audit detail missing success`);
  return response.body?.data ?? null;
}

async function fetchAdminOrderDetail(
  adminClient: CookieClient,
  invoiceNo: string,
  label: string
) {
  const response = await adminClient.request(
    `/api/admin/orders/by-invoice/${encodeURIComponent(invoiceNo)}`
  );
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: admin order detail missing success`);
  return response.body?.data ?? null;
}

async function fetchPublicTracking(invoiceNo: string, label: string) {
  const response = await fetch(`${BASE_URL}/api/store/orders/${encodeURIComponent(invoiceNo)}`, {
    headers: { Accept: "application/json" },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  assert.equal(response.status, 200, `${label}: expected HTTP 200, received ${response.status} (${text})`);
  return body?.data ?? null;
}

async function submitProof(customerClient: CookieClient, paymentId: number, label: string) {
  const response = await customerClient.request(`/api/payments/${paymentId}/proof`, {
    method: "POST",
    body: JSON.stringify({
      proofImageUrl: `https://example.com/${RUN_ID}-${label}.png`,
      senderName: `Buyer ${label}`,
      senderBankOrWallet: "Bank MVF",
      transferAmount: 125000,
      transferTime: new Date().toISOString(),
      note: `Proof ${label}`,
    }),
  });
  assertStatus(response, 201, `${label} submit proof`);
  assert.equal(Boolean(response.body?.success), true, `${label}: proof submit missing success`);
  return response.body?.data ?? null;
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
  return response.body?.data ?? null;
}

function findReviewItem(listData: any, suborderId: number, label: string) {
  const items = Array.isArray(listData?.items) ? listData.items : [];
  const item = items.find((entry: any) => toNumber(entry?.suborderId, 0) === suborderId) || null;
  assert.ok(item, `${label}: suborder ${suborderId} missing from seller review list`);
  return item;
}

function findAdminSuborder(auditDetail: any, suborderId: number, label: string) {
  const item =
    (Array.isArray(auditDetail?.suborders) ? auditDetail.suborders : []).find(
      (entry: any) => toNumber(entry?.suborderId, 0) === suborderId
    ) || null;
  assert.ok(item, `${label}: admin audit suborder ${suborderId} missing`);
  return item;
}

function findAdminSplitGroup(auditDetail: any, suborderId: number, label: string) {
  const group =
    (Array.isArray(auditDetail?.split?.groups) ? auditDetail.split.groups : []).find(
      (entry: any) => toNumber(entry?.suborderId, 0) === suborderId
    ) || null;
  assert.ok(group, `${label}: admin split group ${suborderId} missing`);
  return group;
}

async function assertPersistedInitialCheckoutStatus(scenario: CheckoutScenario, label: string) {
  const order = await Order.findByPk(scenario.orderId, {
    attributes: ["id", "status", "paymentStatus"],
  });
  assert.ok(order, `${label}: parent order missing`);
  assert.equal(String(order?.get("status") || ""), "pending", `${label}: parent order status mismatch`);
  assert.equal(
    String(order?.get("paymentStatus") || ""),
    "UNPAID",
    `${label}: parent payment status mismatch`
  );

  const suborder = await Suborder.findByPk(scenario.suborderId, {
    attributes: ["id", "paymentStatus", "fulfillmentStatus"],
  });
  assert.ok(suborder, `${label}: suborder missing`);
  assert.equal(
    String(suborder?.get("paymentStatus") || ""),
    "UNPAID",
    `${label}: suborder payment status mismatch`
  );
  assert.equal(
    String(suborder?.get("fulfillmentStatus") || ""),
    "UNFULFILLED",
    `${label}: suborder fulfillment status mismatch`
  );

  const payment = await Payment.findByPk(scenario.paymentId, {
    attributes: ["id", "status"],
  });
  assert.ok(payment, `${label}: payment missing`);
  assert.equal(
    String(payment?.get("status") || ""),
    "CREATED",
    `${label}: payment record status mismatch`
  );
}

async function assertPersistedFulfillmentStatus(
  scenario: CheckoutScenario,
  expected: {
    parentOrderStatus: string;
    suborderFulfillmentStatus: string;
    shipmentStatus: string;
  },
  label: string
) {
  const order = await Order.findByPk(scenario.orderId, {
    attributes: ["id", "status", "paymentStatus"],
  });
  assert.ok(order, `${label}: parent order missing`);
  assert.equal(
    String(order?.get("status") || ""),
    expected.parentOrderStatus,
    `${label}: parent order status mismatch`
  );
  assert.equal(
    String(order?.get("paymentStatus") || ""),
    "PAID",
    `${label}: parent payment status mismatch`
  );

  const suborder = await Suborder.findByPk(scenario.suborderId, {
    attributes: ["id", "paymentStatus", "fulfillmentStatus"],
  });
  assert.ok(suborder, `${label}: suborder missing`);
  assert.equal(
    String(suborder?.get("paymentStatus") || ""),
    "PAID",
    `${label}: suborder payment status mismatch`
  );
  assert.equal(
    String(suborder?.get("fulfillmentStatus") || ""),
    expected.suborderFulfillmentStatus,
    `${label}: suborder fulfillment status mismatch`
  );

  const shipment = await Shipment.findOne({
    where: { suborderId: scenario.suborderId } as any,
    attributes: ["id", "status"],
  });
  assert.ok(shipment, `${label}: shipment missing`);
  assert.equal(
    String(shipment?.get("status") || ""),
    expected.shipmentStatus,
    `${label}: shipment status mismatch`
  );
}

async function expectCheckoutConflict(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  label: string;
  couponCode?: string;
  skipCartSetup?: boolean;
}) {
  if (!input.skipCartSetup) {
    await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  }
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
      couponCode: input.couponCode,
      shippingDetails,
    }),
  });
  assertStatus(response, 409, `${input.label} checkout conflict`);
  assert.equal(Boolean(response.body?.success), false, `${input.label}: conflict should return success=false`);
  return response.body ?? null;
}

async function runApproveScenario(input: {
  customerClient: CookieClient;
  sellerClient: CookieClient;
  adminClient: CookieClient;
  buyerUserId: number;
  productId: number;
  storeId: number;
}) {
  logStep("approve scenario: create checkout");
  const scenario = await createCheckoutOrder({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "approve",
    storeId: input.storeId,
  });

  const initialBuyerView = await fetchBuyerGroupedOrder(
    input.customerClient,
    scenario.orderId,
    "approve buyer initial grouped view"
  );
  assertInitialState(initialBuyerView, "approve buyer initial grouped view");
  await assertPersistedInitialCheckoutStatus(scenario, "approve persisted initial checkout");

  const initialSellerDetail = await fetchSellerOrderDetail(
    input.sellerClient,
    input.storeId,
    scenario.suborderId,
    "approve seller initial detail"
  );
  assert.equal(
    String(initialSellerDetail?.paymentStatus || ""),
    "UNPAID",
    "approve seller initial detail: suborder paymentStatus should be UNPAID"
  );
  assert.equal(
    String(initialSellerDetail?.fulfillmentStatus || ""),
    "UNFULFILLED",
    "approve seller initial detail: fulfillmentStatus should be UNFULFILLED"
  );
  assert.equal(
    String(initialSellerDetail?.paymentSummary?.status || initialSellerDetail?.payment?.status || ""),
    "CREATED",
    "approve seller initial detail: payment record should be CREATED"
  );
  assert.equal(
    String(initialSellerDetail?.operationalTruth?.bridge?.paymentToShipment || ""),
    "BLOCKED",
    "approve seller initial detail: shipment should start blocked by payment"
  );
  assert.equal(
    Boolean(
      Array.isArray(initialSellerDetail?.operationalTruth?.actions?.sellerFulfillment) &&
        initialSellerDetail.operationalTruth.actions.sellerFulfillment.some(
          (action: any) => action?.enabled === true
        )
    ),
    false,
    "approve seller initial detail: fulfillment actions should be disabled before payment"
  );

  const initialAdminAudit = await fetchAdminAuditDetail(
    input.adminClient,
    scenario.orderId,
    "approve admin initial audit detail"
  );
  const initialAdminAuditGroup = findAdminSplitGroup(
    initialAdminAudit,
    scenario.suborderId,
    "approve admin initial audit detail"
  );
  const initialAdminAuditSuborder = findAdminSuborder(
    initialAdminAudit,
    scenario.suborderId,
    "approve admin initial audit detail"
  );
  assert.equal(
    String(initialAdminAudit?.parent?.paymentStatus || ""),
    "UNPAID",
    "approve admin initial: parent paymentStatus should be UNPAID"
  );
  assert.equal(
    String(initialAdminAudit?.parent?.orderStatus || ""),
    "pending",
    "approve admin initial: parent orderStatus should be pending"
  );
  assert.equal(
    String(initialAdminAuditGroup?.payment?.status || ""),
    "CREATED",
    "approve admin initial: split payment should be CREATED"
  );
  assert.equal(
    String(initialAdminAuditSuborder?.paymentStatus || ""),
    "UNPAID",
    "approve admin initial: suborder paymentStatus should be UNPAID"
  );
  assert.equal(
    String(initialAdminAuditSuborder?.fulfillmentStatus || ""),
    "UNFULFILLED",
    "approve admin initial: suborder fulfillmentStatus should be UNFULFILLED"
  );

  const initialAdminOrderDetail = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "approve admin initial order detail"
  );
  assert.equal(
    String(initialAdminOrderDetail?.contract?.paymentActionability?.code || ""),
    "ACTION_REQUIRED",
    "approve admin initial order detail: paymentActionability should be ACTION_REQUIRED"
  );

  const initialPublicTracking = await fetchPublicTracking(
    scenario.invoiceNo,
    "approve public initial tracking"
  );
  assert.equal(
    String(initialPublicTracking?.contract?.paymentActionability?.code || ""),
    "ACTION_REQUIRED",
    "approve public initial tracking: paymentActionability should be ACTION_REQUIRED"
  );
  assert.equal(
    String(initialPublicTracking?.storeSplits?.[0]?.contract?.paymentStatus || ""),
    "UNPAID",
    "approve public initial tracking: split contract paymentStatus should be UNPAID"
  );
  assert.equal(
    String(initialPublicTracking?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "CREATED",
    "approve public initial tracking: split paymentReadModel should be CREATED"
  );
  assert.equal(
    String(
      initialPublicTracking?.storeSplits?.[0]?.shippingStatus ||
        initialPublicTracking?.storeSplits?.[0]?.operationalTruth?.shipment?.status ||
        ""
    ),
    "WAITING_PAYMENT",
    "approve public initial tracking: shipment should be waiting for payment"
  );
  await expectSellerFulfillmentBlocked({
    sellerClient: input.sellerClient,
    storeId: input.storeId,
    suborderId: scenario.suborderId,
    action: "MARK_PROCESSING",
    expectedCode: "SUBORDER_PAYMENT_NOT_SETTLED",
    label: "approve seller pre-payment fulfillment gate",
  });
  logPass("approve scenario initial state");

  logStep("approve scenario: buyer submit proof");
  const proofDetail = await submitProof(input.customerClient, scenario.paymentId, "approve");
  assert.equal(
    String(proofDetail?.status || ""),
    "PENDING_CONFIRMATION",
    "approve submit proof: payment status should be PENDING_CONFIRMATION"
  );

  const pendingReview = await fetchSellerPaymentReviewList(
    input.sellerClient,
    input.storeId,
    "PENDING_CONFIRMATION",
    "approve seller payment review pending list"
  );
  const pendingReviewItem = findReviewItem(
    pendingReview,
    scenario.suborderId,
    "approve seller payment review pending list"
  );
  assert.equal(
    String(pendingReviewItem?.payment?.status || ""),
    "PENDING_CONFIRMATION",
    "approve pending review: payment record should be PENDING_CONFIRMATION"
  );
  assert.equal(
    String(pendingReviewItem?.paymentStatus || ""),
    "PENDING_CONFIRMATION",
    "approve pending review: suborder paymentStatus should be PENDING_CONFIRMATION"
  );
  logPass("approve scenario pending confirmation");

  logStep("approve scenario: seller approve proof");
  const sellerApproved = await reviewPayment(
    input.sellerClient,
    input.storeId,
    scenario.paymentId,
    "APPROVE",
    "approve scenario"
  );
  assert.equal(String(sellerApproved?.paymentStatus || ""), "PAID", "approve scenario: suborder should be PAID");
  assert.equal(String(sellerApproved?.payment?.status || ""), "PAID", "approve scenario: payment record should be PAID");
  assert.equal(
    String(sellerApproved?.fulfillmentStatus || ""),
    "UNFULFILLED",
    "approve scenario: approval should not auto-pack the suborder"
  );

  const sellerPaidReady = await fetchSellerOrderDetail(
    input.sellerClient,
    input.storeId,
    scenario.suborderId,
    "approve seller paid ready detail"
  );
  assert.equal(
    String(sellerPaidReady?.paymentStatus || ""),
    "PAID",
    "approve seller paid ready: suborder paymentStatus should be PAID"
  );
  assert.equal(
    String(sellerPaidReady?.fulfillmentStatus || ""),
    "UNFULFILLED",
    "approve seller paid ready: fulfillment should not auto-pack"
  );
  assert.equal(
    String(sellerPaidReady?.shippingStatus || sellerPaidReady?.operationalTruth?.shipment?.status || ""),
    "READY_TO_FULFILL",
    "approve seller paid ready: shipment should be ready to fulfill"
  );
  assert.equal(
    String(sellerPaidReady?.operationalTruth?.bridge?.paymentToShipment || ""),
    "READY",
    "approve seller paid ready: payment-to-shipment bridge should be ready"
  );
  assert.equal(
    Boolean(
      Array.isArray(sellerPaidReady?.operationalTruth?.actions?.sellerFulfillment) &&
        sellerPaidReady.operationalTruth.actions.sellerFulfillment.some(
          (action: any) => action?.code === "MARK_PROCESSING" && action?.enabled !== false
        )
    ),
    true,
    "approve seller paid ready: MARK_PROCESSING should be available after payment is PAID"
  );
  assert.equal(
    Boolean(
      Array.isArray(sellerPaidReady?.shipments?.[0]?.availableShippingActions) &&
        sellerPaidReady.shipments[0].availableShippingActions.some(
          (action: any) => action?.code === "MARK_PROCESSING" && action?.enabled === true
        )
    ),
    true,
    "approve seller paid ready: shipment MARK_PROCESSING should be enabled after payment is PAID"
  );

  const buyerPaid = await fetchBuyerGroupedOrder(
    input.customerClient,
    scenario.orderId,
    "approve buyer grouped paid view"
  );
  const buyerPaidGroup = getSingleGroup(buyerPaid, "approve buyer grouped paid view");
  assert.equal(String(buyerPaid?.paymentStatus || ""), "PAID", "approve buyer: parent paymentStatus should be PAID");
  assert.equal(
    String(buyerPaid?.paymentEntry?.summaryStatus || ""),
    "PAID",
    "approve buyer: paymentEntry should be PAID"
  );
  assert.equal(String(buyerPaid?.orderStatus || ""), "processing", "approve buyer: parent orderStatus should move to processing");
  assert.equal(String(buyerPaidGroup?.paymentStatus || ""), "PAID", "approve buyer: suborder paymentStatus should be PAID");
  assert.equal(String(buyerPaidGroup?.payment?.status || ""), "PAID", "approve buyer: payment record should be PAID");
  assert.equal(
    String(buyerPaidGroup?.fulfillmentStatus || ""),
    "UNFULFILLED",
    "approve buyer: split should still wait for seller packing"
  );
  assert.equal(
    String(
      buyerPaidGroup?.shippingStatus ||
        buyerPaidGroup?.operationalTruth?.shipment?.status ||
        ""
    ),
    "READY_TO_FULFILL",
    "approve buyer: shipment should be ready to fulfill, not packed"
  );
  assert.equal(
    String(buyerPaidGroup?.paymentReadModel?.status || ""),
    "PAID",
    "approve buyer: paymentReadModel should be PAID"
  );

  const paidPaymentDetail = await fetchPaymentDetail(
    input.customerClient,
    scenario.paymentId,
    "approve payment detail"
  );
  assert.equal(
    String(paidPaymentDetail?.readModel?.status || ""),
    "PAID",
    "approve payment detail: readModel should be PAID"
  );

  const adminPaid = await fetchAdminAuditDetail(
    input.adminClient,
    scenario.orderId,
    "approve admin audit detail"
  );
  const adminPaidGroup = findAdminSplitGroup(adminPaid, scenario.suborderId, "approve admin audit detail");
  const adminPaidSuborder = findAdminSuborder(adminPaid, scenario.suborderId, "approve admin audit detail");
  assert.equal(String(adminPaid?.parent?.paymentStatus || ""), "PAID", "approve admin: parent paymentStatus should be PAID");
  assert.equal(String(adminPaid?.parent?.orderStatus || ""), "processing", "approve admin: parent orderStatus should be processing");
  assert.equal(String(adminPaidGroup?.payment?.status || ""), "PAID", "approve admin: split payment should be PAID");
  assert.equal(String(adminPaidSuborder?.paymentStatus || ""), "PAID", "approve admin: suborder paymentStatus should be PAID");
  assert.equal(
    String(adminPaidSuborder?.fulfillmentStatus || ""),
    "UNFULFILLED",
    "approve admin: split should still wait for seller packing"
  );
  assert.equal(
    String(adminPaidSuborder?.shippingStatus || adminPaidSuborder?.operationalTruth?.shipment?.status || ""),
    "READY_TO_FULFILL",
    "approve admin: shipment should be ready to fulfill after approval"
  );

  const adminOrderDetail = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "approve admin order detail"
  );
  assert.equal(
    String(adminOrderDetail?.contract?.paymentActionability?.code || ""),
    "PAID",
    "approve admin order detail: paymentActionability should be PAID"
  );
  assert.equal(
    String(adminOrderDetail?.contract?.statusSummary?.label || ""),
    "Processing",
    "approve admin order detail: statusSummary should be Processing"
  );

  const publicTracking = await fetchPublicTracking(
    scenario.invoiceNo,
    "approve public tracking"
  );
  assert.equal(
    String(publicTracking?.contract?.paymentActionability?.code || ""),
    "PAID",
    "approve public tracking: paymentActionability should be PAID"
  );
  assert.equal(
    String(publicTracking?.storeSplits?.[0]?.contract?.paymentStatus || ""),
    "PAID",
    "approve public tracking: split contract paymentStatus should be PAID"
  );
  assert.equal(
    String(publicTracking?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "PAID",
    "approve public tracking: split paymentReadModel should be PAID"
  );
  assert.equal(
    String(publicTracking?.storeSplits?.[0]?.shippingStatus || publicTracking?.storeSplits?.[0]?.operationalTruth?.shipment?.status || ""),
    "READY_TO_FULFILL",
    "approve public tracking: split shipment should stay ready to fulfill after approval"
  );
  assert.equal(
    String(publicTracking?.items?.[0]?.imageUrl || ""),
    "/uploads/products/demo.svg",
    "approve public tracking: invoice item should expose normalized product imageUrl"
  );

  logStep("approve scenario: seller marks shipment packed");
  const packedMutation = await updateSellerFulfillment({
    sellerClient: input.sellerClient,
    storeId: input.storeId,
    suborderId: scenario.suborderId,
    action: "MARK_PROCESSING",
    label: "approve seller mark packed",
  });
  assert.equal(
    String(packedMutation?.transition?.to || ""),
    "PROCESSING",
    "approve mark packed: compatibility fulfillment transition mismatch"
  );
  assert.equal(
    String(packedMutation?.transition?.shipmentTo || ""),
    "PACKED",
    "approve mark packed: canonical shipment transition mismatch"
  );
  assert.equal(
    String(packedMutation?.suborder?.paymentStatus || ""),
    "PAID",
    "approve mark packed: suborder paymentStatus should remain PAID"
  );
  assert.equal(
    String(packedMutation?.suborder?.fulfillmentStatus || ""),
    "PROCESSING",
    "approve mark packed: suborder fulfillmentStatus should be PROCESSING"
  );
  assert.equal(
    String(packedMutation?.suborder?.shippingStatus || packedMutation?.suborder?.operationalTruth?.shipment?.status || ""),
    "PACKED",
    "approve mark packed: suborder shipment should be PACKED"
  );
  await assertPersistedFulfillmentStatus(
    scenario,
    {
      parentOrderStatus: "processing",
      suborderFulfillmentStatus: "PROCESSING",
      shipmentStatus: "PACKED",
    },
    "approve persisted packed fulfillment"
  );

  const sellerPacked = await fetchSellerOrderDetail(
    input.sellerClient,
    input.storeId,
    scenario.suborderId,
    "approve seller packed detail"
  );
  assert.equal(
    String(sellerPacked?.paymentStatus || ""),
    "PAID",
    "approve seller packed: paymentStatus should remain PAID"
  );
  assert.equal(
    String(sellerPacked?.fulfillmentStatus || ""),
    "PROCESSING",
    "approve seller packed: fulfillmentStatus should be PROCESSING"
  );
  assert.equal(
    String(sellerPacked?.shippingStatus || sellerPacked?.operationalTruth?.shipment?.status || ""),
    "PACKED",
    "approve seller packed: shipment should be PACKED"
  );
  assert.equal(
    Boolean(
      Array.isArray(sellerPacked?.operationalTruth?.actions?.sellerFulfillment) &&
        sellerPacked.operationalTruth.actions.sellerFulfillment.some(
          (action: any) => action?.code === "MARK_SHIPPED" && action?.enabled !== false
        )
    ),
    true,
    "approve seller packed: MARK_SHIPPED should become the next seller fulfillment action"
  );

  const adminPacked = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "approve admin packed order detail"
  );
  const adminPackedGroup = getSingleGroup(adminPacked, "approve admin packed order detail");
  assert.equal(
    String(adminPacked?.paymentStatus || adminPacked?.contract?.paymentStatus || ""),
    "PAID",
    "approve admin packed: parent paymentStatus should remain PAID"
  );
  assert.equal(
    String(adminPacked?.rawStatus || adminPacked?.status || ""),
    "processing",
    "approve admin packed: parent order status should remain processing"
  );
  assert.equal(
    String(adminPackedGroup?.paymentStatus || ""),
    "PAID",
    "approve admin packed: split paymentStatus should remain PAID"
  );
  assert.equal(
    String(adminPackedGroup?.fulfillmentStatus || ""),
    "PROCESSING",
    "approve admin packed: split fulfillmentStatus should be PROCESSING"
  );
  assert.equal(
    String(adminPackedGroup?.shippingStatus || ""),
    "PACKED",
    "approve admin packed: split shippingStatus should be PACKED"
  );
  assert.equal(
    String(adminPacked?.suborderShipmentSummary?.[0]?.shippingStatus || ""),
    "PACKED",
    "approve admin packed: shipment reconciliation summary should be PACKED"
  );
  assert.equal(
    String(adminPacked?.shipments?.[0]?.shipmentStatus || ""),
    "PACKED",
    "approve admin packed: persisted shipment should be PACKED"
  );

  const publicPacked = await fetchPublicTracking(
    scenario.invoiceNo,
    "approve public packed tracking"
  );
  assert.equal(
    String(publicPacked?.contract?.paymentActionability?.code || ""),
    "PAID",
    "approve public packed: paymentActionability should remain PAID"
  );
  assert.equal(
    String(publicPacked?.storeSplits?.[0]?.contract?.paymentStatus || ""),
    "PAID",
    "approve public packed: split contract paymentStatus should remain PAID"
  );
  assert.equal(
    String(publicPacked?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "PAID",
    "approve public packed: split paymentReadModel should remain PAID"
  );
  assert.equal(
    String(publicPacked?.storeSplits?.[0]?.shippingStatus || publicPacked?.storeSplits?.[0]?.operationalTruth?.shipment?.status || ""),
    "PACKED",
    "approve public packed: split shipment should be PACKED"
  );
  assert.equal(
    String(publicPacked?.storeSplits?.[0]?.shippingStatusMeta?.label || ""),
    "Packed",
    "approve public packed: split shipment should expose buyer-friendly packed label"
  );
  assert.equal(
    String(publicPacked?.storeSplits?.[0]?.operationalTruth?.statusSummary?.lane || ""),
    "SHIPMENT",
    "approve public packed: status summary should stay on shipment lane"
  );
  assert.equal(
    String(publicPacked?.storeSplits?.[0]?.operationalTruth?.statusSummary?.code || ""),
    "PACKED",
    "approve public packed: status summary should expose PACKED"
  );

  await expectSellerFulfillmentBlocked({
    sellerClient: input.sellerClient,
    storeId: input.storeId,
    suborderId: scenario.suborderId,
    action: "MARK_SHIPPED",
    expectedCode: "TRACKING_NUMBER_REQUIRED",
    label: "approve seller shipped tracking guard",
    body: {
      courierService: "MVF Courier",
    },
  });

  await expectSellerFulfillmentBlocked({
    sellerClient: input.sellerClient,
    storeId: input.storeId,
    suborderId: scenario.suborderId,
    action: "MARK_SHIPPED",
    expectedCode: "COURIER_DETAILS_REQUIRED",
    label: "approve seller shipped courier guard",
    body: {
      trackingNumber: `${RUN_ID}-TRACK-001`,
    },
  });

  logStep("approve scenario: seller marks shipment shipped");
  const shippedMutation = await updateSellerFulfillment({
    sellerClient: input.sellerClient,
    storeId: input.storeId,
    suborderId: scenario.suborderId,
    action: "MARK_SHIPPED",
    label: "approve seller mark shipped",
    trackingNumber: `${RUN_ID}-TRACK-001`,
    courierService: "MVF Courier",
  });
  assert.equal(
    String(shippedMutation?.transition?.to || ""),
    "SHIPPED",
    "approve mark shipped: compatibility fulfillment transition mismatch"
  );
  assert.equal(
    String(shippedMutation?.transition?.shipmentTo || ""),
    "SHIPPED",
    "approve mark shipped: canonical shipment transition mismatch"
  );
  assert.equal(
    String(shippedMutation?.parentOrderSync?.to || ""),
    "shipped",
    "approve mark shipped: parent order should sync to shipped for a single active split"
  );
  assert.equal(
    String(shippedMutation?.suborder?.paymentStatus || ""),
    "PAID",
    "approve mark shipped: suborder paymentStatus should remain PAID"
  );
  assert.equal(
    String(shippedMutation?.suborder?.fulfillmentStatus || ""),
    "SHIPPED",
    "approve mark shipped: suborder fulfillmentStatus should be SHIPPED"
  );
  assert.equal(
    String(shippedMutation?.suborder?.shippingStatus || shippedMutation?.suborder?.operationalTruth?.shipment?.status || ""),
    "SHIPPED",
    "approve mark shipped: suborder shipment should be SHIPPED"
  );
  await assertPersistedFulfillmentStatus(
    scenario,
    {
      parentOrderStatus: "shipped",
      suborderFulfillmentStatus: "SHIPPED",
      shipmentStatus: "SHIPPED",
    },
    "approve persisted shipped fulfillment"
  );

  const sellerShipped = await fetchSellerOrderDetail(
    input.sellerClient,
    input.storeId,
    scenario.suborderId,
    "approve seller shipped detail"
  );
  assert.equal(
    String(sellerShipped?.order?.status || ""),
    "shipped",
    "approve seller shipped: parent order status should be shipped"
  );
  assert.equal(
    String(sellerShipped?.paymentStatus || ""),
    "PAID",
    "approve seller shipped: paymentStatus should remain PAID"
  );
  assert.equal(
    String(sellerShipped?.fulfillmentStatus || ""),
    "SHIPPED",
    "approve seller shipped: fulfillmentStatus should be SHIPPED"
  );
  assert.equal(
    String(sellerShipped?.shippingStatus || sellerShipped?.operationalTruth?.shipment?.status || ""),
    "SHIPPED",
    "approve seller shipped: shipment should be SHIPPED"
  );
  assert.equal(
    String(sellerShipped?.shipments?.[0]?.trackingNumber || ""),
    `${RUN_ID}-TRACK-001`,
    "approve seller shipped: tracking number should be retained"
  );
  assert.equal(
    String(sellerShipped?.shipments?.[0]?.courierService || ""),
    "MVF Courier",
    "approve seller shipped: courier service should be retained"
  );
  assert.equal(
    Boolean(
      Array.isArray(sellerShipped?.operationalTruth?.actions?.sellerFulfillment) &&
        sellerShipped.operationalTruth.actions.sellerFulfillment.some(
          (action: any) => action?.code === "MARK_DELIVERED" && action?.enabled !== false
        )
    ),
    true,
    "approve seller shipped: MARK_DELIVERED should become the next seller fulfillment action"
  );

  const adminShipped = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "approve admin shipped order detail"
  );
  const adminShippedGroup = getSingleGroup(adminShipped, "approve admin shipped order detail");
  assert.equal(
    String(adminShipped?.rawStatus || adminShipped?.status || ""),
    "shipped",
    "approve admin shipped: parent order status should be shipped"
  );
  assert.equal(
    String(adminShipped?.paymentStatus || adminShipped?.contract?.paymentStatus || ""),
    "PAID",
    "approve admin shipped: parent paymentStatus should remain PAID"
  );
  assert.equal(
    String(adminShipped?.shippingStatus || ""),
    "SHIPPED",
    "approve admin shipped: parent aggregate shippingStatus should be SHIPPED"
  );
  assert.equal(
    String(adminShippedGroup?.paymentStatus || ""),
    "PAID",
    "approve admin shipped: split paymentStatus should remain PAID"
  );
  assert.equal(
    String(adminShippedGroup?.fulfillmentStatus || ""),
    "SHIPPED",
    "approve admin shipped: split fulfillmentStatus should be SHIPPED"
  );
  assert.equal(
    String(adminShippedGroup?.shippingStatus || ""),
    "SHIPPED",
    "approve admin shipped: split shippingStatus should be SHIPPED"
  );
  assert.equal(
    String(adminShipped?.suborderShipmentSummary?.[0]?.shippingStatus || ""),
    "SHIPPED",
    "approve admin shipped: shipment reconciliation summary should be SHIPPED"
  );
  assert.equal(
    String(adminShipped?.shipments?.[0]?.shipmentStatus || ""),
    "SHIPPED",
    "approve admin shipped: persisted shipment should be SHIPPED"
  );
  assert.equal(
    String(adminShipped?.shipments?.[0]?.trackingNumber || ""),
    `${RUN_ID}-TRACK-001`,
    "approve admin shipped: tracking number should be retained"
  );

  const publicShipped = await fetchPublicTracking(
    scenario.invoiceNo,
    "approve public shipped tracking"
  );
  assert.ok(
    ["shipped", "shipping"].includes(String(publicShipped?.orderStatus || publicShipped?.status || "")),
    "approve public shipped: parent order status should be shipped/shipping"
  );
  assert.equal(
    String(publicShipped?.contract?.paymentActionability?.code || ""),
    "PAID",
    "approve public shipped: paymentActionability should remain PAID"
  );
  assert.equal(
    String(publicShipped?.shippingStatus || ""),
    "SHIPPED",
    "approve public shipped: parent aggregate shippingStatus should be SHIPPED"
  );
  assert.equal(
    String(publicShipped?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "PAID",
    "approve public shipped: split paymentReadModel should remain PAID"
  );
  assert.equal(
    String(publicShipped?.storeSplits?.[0]?.fulfillmentStatus || ""),
    "SHIPPED",
    "approve public shipped: split fulfillmentStatus should be SHIPPED"
  );
  assert.equal(
    String(publicShipped?.storeSplits?.[0]?.shippingStatus || publicShipped?.storeSplits?.[0]?.operationalTruth?.shipment?.status || ""),
    "SHIPPED",
    "approve public shipped: split shipment should be SHIPPED"
  );
  assert.equal(
    String(publicShipped?.storeSplits?.[0]?.shippingStatusMeta?.label || ""),
    "Shipped",
    "approve public shipped: split shipment should expose buyer-friendly shipped label"
  );
  assert.equal(
    String(publicShipped?.storeSplits?.[0]?.operationalTruth?.statusSummary?.code || ""),
    "SHIPPED",
    "approve public shipped: status summary should expose SHIPPED"
  );
  assert.equal(
    String(publicShipped?.shipments?.[0]?.trackingNumber || ""),
    `${RUN_ID}-TRACK-001`,
    "approve public shipped: tracking number should be retained"
  );

  logStep("approve scenario: seller marks shipment delivered");
  const deliveredMutation = await updateSellerFulfillment({
    sellerClient: input.sellerClient,
    storeId: input.storeId,
    suborderId: scenario.suborderId,
    action: "MARK_DELIVERED",
    label: "approve seller mark delivered",
  });
  assert.equal(
    String(deliveredMutation?.transition?.to || ""),
    "DELIVERED",
    "approve mark delivered: compatibility fulfillment transition mismatch"
  );
  assert.equal(
    String(deliveredMutation?.transition?.shipmentTo || ""),
    "DELIVERED",
    "approve mark delivered: canonical shipment transition mismatch"
  );
  assert.equal(
    String(deliveredMutation?.parentOrderSync?.to || ""),
    "delivered",
    "approve mark delivered: parent order should sync to delivered for a single active split"
  );
  assert.equal(
    String(deliveredMutation?.suborder?.paymentStatus || ""),
    "PAID",
    "approve mark delivered: suborder paymentStatus should remain PAID"
  );
  assert.equal(
    String(deliveredMutation?.suborder?.fulfillmentStatus || ""),
    "DELIVERED",
    "approve mark delivered: suborder fulfillmentStatus should be DELIVERED"
  );
  assert.equal(
    String(deliveredMutation?.suborder?.shippingStatus || deliveredMutation?.suborder?.operationalTruth?.shipment?.status || ""),
    "DELIVERED",
    "approve mark delivered: suborder shipment should be DELIVERED"
  );
  await assertPersistedFulfillmentStatus(
    scenario,
    {
      parentOrderStatus: "delivered",
      suborderFulfillmentStatus: "DELIVERED",
      shipmentStatus: "DELIVERED",
    },
    "approve persisted delivered fulfillment"
  );

  const sellerDelivered = await fetchSellerOrderDetail(
    input.sellerClient,
    input.storeId,
    scenario.suborderId,
    "approve seller delivered detail"
  );
  assert.equal(
    String(sellerDelivered?.order?.status || ""),
    "delivered",
    "approve seller delivered: parent order status should be delivered"
  );
  assert.equal(
    String(sellerDelivered?.paymentStatus || ""),
    "PAID",
    "approve seller delivered: paymentStatus should remain PAID"
  );
  assert.equal(
    String(sellerDelivered?.fulfillmentStatus || ""),
    "DELIVERED",
    "approve seller delivered: fulfillmentStatus should be DELIVERED"
  );
  assert.equal(
    String(sellerDelivered?.shippingStatus || sellerDelivered?.operationalTruth?.shipment?.status || ""),
    "DELIVERED",
    "approve seller delivered: shipment should be DELIVERED"
  );
  assert.equal(
    Boolean(
      Array.isArray(sellerDelivered?.operationalTruth?.actions?.sellerFulfillment) &&
        sellerDelivered.operationalTruth.actions.sellerFulfillment.some(
          (action: any) => action?.enabled !== false
        )
    ),
    false,
    "approve seller delivered: no forward seller fulfillment action should remain"
  );

  const adminDelivered = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "approve admin delivered order detail"
  );
  const adminDeliveredGroup = getSingleGroup(adminDelivered, "approve admin delivered order detail");
  assert.equal(
    String(adminDelivered?.rawStatus || adminDelivered?.status || ""),
    "delivered",
    "approve admin delivered: parent order status should be delivered"
  );
  assert.equal(
    String(adminDelivered?.paymentStatus || adminDelivered?.contract?.paymentStatus || ""),
    "PAID",
    "approve admin delivered: parent paymentStatus should remain PAID"
  );
  assert.equal(
    String(adminDelivered?.shippingStatus || ""),
    "DELIVERED",
    "approve admin delivered: parent aggregate shippingStatus should be DELIVERED"
  );
  assert.equal(
    String(adminDeliveredGroup?.paymentStatus || ""),
    "PAID",
    "approve admin delivered: split paymentStatus should remain PAID"
  );
  assert.equal(
    String(adminDeliveredGroup?.fulfillmentStatus || ""),
    "DELIVERED",
    "approve admin delivered: split fulfillmentStatus should be DELIVERED"
  );
  assert.equal(
    String(adminDeliveredGroup?.shippingStatus || ""),
    "DELIVERED",
    "approve admin delivered: split shippingStatus should be DELIVERED"
  );
  assert.equal(
    String(adminDelivered?.suborderShipmentSummary?.[0]?.shippingStatus || ""),
    "DELIVERED",
    "approve admin delivered: shipment reconciliation summary should be DELIVERED"
  );
  assert.equal(
    String(adminDelivered?.shipments?.[0]?.shipmentStatus || ""),
    "DELIVERED",
    "approve admin delivered: persisted shipment should be DELIVERED"
  );

  const publicDelivered = await fetchPublicTracking(
    scenario.invoiceNo,
    "approve public delivered tracking"
  );
  assert.ok(
    ["delivered", "complete"].includes(String(publicDelivered?.orderStatus || publicDelivered?.status || "")),
    "approve public delivered: parent order status should be delivered/complete"
  );
  assert.equal(
    String(publicDelivered?.contract?.paymentActionability?.code || ""),
    "PAID",
    "approve public delivered: paymentActionability should remain PAID"
  );
  assert.equal(
    String(publicDelivered?.shippingStatus || ""),
    "DELIVERED",
    "approve public delivered: parent aggregate shippingStatus should be DELIVERED"
  );
  assert.equal(
    String(publicDelivered?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "PAID",
    "approve public delivered: split paymentReadModel should remain PAID"
  );
  assert.equal(
    String(publicDelivered?.storeSplits?.[0]?.fulfillmentStatus || ""),
    "DELIVERED",
    "approve public delivered: split fulfillmentStatus should be DELIVERED"
  );
  assert.equal(
    String(publicDelivered?.storeSplits?.[0]?.shippingStatus || publicDelivered?.storeSplits?.[0]?.operationalTruth?.shipment?.status || ""),
    "DELIVERED",
    "approve public delivered: split shipment should be DELIVERED"
  );
  assert.equal(
    String(publicDelivered?.storeSplits?.[0]?.shippingStatusMeta?.label || ""),
    "Delivered",
    "approve public delivered: split shipment should expose buyer-friendly delivered label"
  );
  assert.equal(
    String(publicDelivered?.storeSplits?.[0]?.operationalTruth?.statusSummary?.code || ""),
    "DELIVERED",
    "approve public delivered: status summary should expose DELIVERED"
  );
  assert.equal(
    String(publicDelivered?.shipments?.[0]?.shipmentStatus || ""),
    "DELIVERED",
    "approve public delivered: persisted shipment should be DELIVERED"
  );
  logPass("approve scenario paid fulfillment delivered sync");
}

async function runRejectScenario(input: {
  customerClient: CookieClient;
  sellerClient: CookieClient;
  adminClient: CookieClient;
  buyerUserId: number;
  productId: number;
  storeId: number;
}) {
  logStep("reject scenario: create checkout");
  const scenario = await createCheckoutOrder({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "reject",
    storeId: input.storeId,
  });

  logStep("reject scenario: buyer submit proof");
  const proofDetail = await submitProof(input.customerClient, scenario.paymentId, "reject");
  assert.equal(
    String(proofDetail?.status || ""),
    "PENDING_CONFIRMATION",
    "reject submit proof: payment status should be PENDING_CONFIRMATION"
  );

  logStep("reject scenario: seller reject proof");
  const sellerRejected = await reviewPayment(
    input.sellerClient,
    input.storeId,
    scenario.paymentId,
    "REJECT",
    "reject scenario"
  );
  assert.equal(String(sellerRejected?.paymentStatus || ""), "UNPAID", "reject scenario: suborder should return to UNPAID");
  assert.equal(String(sellerRejected?.payment?.status || ""), "REJECTED", "reject scenario: payment record should be REJECTED");

  const rejectedList = await fetchSellerPaymentReviewList(
    input.sellerClient,
    input.storeId,
    "REJECTED",
    "reject seller payment review rejected list"
  );
  const rejectedItem = findReviewItem(
    rejectedList,
    scenario.suborderId,
    "reject seller payment review rejected list"
  );
  assert.equal(
    String(rejectedItem?.paymentStatus || ""),
    "UNPAID",
    "reject seller list: suborder paymentStatus should stay UNPAID"
  );
  assert.equal(
    String(rejectedItem?.payment?.status || ""),
    "REJECTED",
    "reject seller list: payment record should be REJECTED"
  );

  const buyerRejected = await fetchBuyerGroupedOrder(
    input.customerClient,
    scenario.orderId,
    "reject buyer grouped view"
  );
  const buyerRejectedGroup = getSingleGroup(buyerRejected, "reject buyer grouped view");
  assert.equal(String(buyerRejected?.paymentStatus || ""), "UNPAID", "reject buyer: parent paymentStatus should be UNPAID");
  assert.equal(String(buyerRejected?.orderStatus || ""), "pending", "reject buyer: parent orderStatus should remain pending");
  assert.equal(String(buyerRejectedGroup?.paymentStatus || ""), "UNPAID", "reject buyer: suborder paymentStatus should be UNPAID");
  assert.equal(String(buyerRejectedGroup?.payment?.status || ""), "REJECTED", "reject buyer: payment record should be REJECTED");
  assert.equal(
    String(buyerRejectedGroup?.payment?.displayStatus || ""),
    "REJECTED",
    "reject buyer: displayStatus should be REJECTED"
  );
  assert.equal(
    String(buyerRejectedGroup?.paymentReadModel?.status || ""),
    "REJECTED",
    "reject buyer: paymentReadModel should be REJECTED"
  );

  const rejectedPaymentDetail = await fetchPaymentDetail(
    input.customerClient,
    scenario.paymentId,
    "reject payment detail"
  );
  assert.equal(
    String(rejectedPaymentDetail?.readModel?.status || ""),
    "REJECTED",
    "reject payment detail: readModel should be REJECTED"
  );
  assert.equal(
    Boolean(rejectedPaymentDetail?.readModel?.proofActionability?.canStartProof),
    true,
    "reject payment detail: proof should remain actionable"
  );

  const adminRejected = await fetchAdminAuditDetail(
    input.adminClient,
    scenario.orderId,
    "reject admin audit detail"
  );
  const adminRejectedGroup = findAdminSplitGroup(
    adminRejected,
    scenario.suborderId,
    "reject admin audit detail"
  );
  const adminRejectedSuborder = findAdminSuborder(
    adminRejected,
    scenario.suborderId,
    "reject admin audit detail"
  );
  assert.equal(String(adminRejected?.parent?.paymentStatus || ""), "UNPAID", "reject admin: parent paymentStatus should be UNPAID");
  assert.equal(String(adminRejectedGroup?.payment?.status || ""), "REJECTED", "reject admin: split payment should be REJECTED");
  assert.equal(String(adminRejectedSuborder?.paymentStatus || ""), "UNPAID", "reject admin: suborder paymentStatus should be UNPAID");

  const adminOrderDetail = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "reject admin order detail"
  );
  assert.equal(
    String(adminOrderDetail?.contract?.paymentActionability?.code || ""),
    "ACTION_REQUIRED",
    "reject admin order detail: paymentActionability should be ACTION_REQUIRED"
  );
  assert.equal(
    Boolean(
      Array.isArray(adminOrderDetail?.contract?.availableActions) &&
        adminOrderDetail.contract.availableActions.some(
          (action: any) => action?.code === "processing" && action?.enabled === false
        )
    ),
    true,
    "reject admin order detail: processing action should stay disabled while unpaid"
  );

  const publicTracking = await fetchPublicTracking(
    scenario.invoiceNo,
    "reject public tracking"
  );
  assert.equal(
    String(publicTracking?.contract?.paymentActionability?.code || ""),
    "ACTION_REQUIRED",
    "reject public tracking: paymentActionability should be ACTION_REQUIRED"
  );
  assert.equal(
    Boolean(
      Array.isArray(publicTracking?.contract?.availableActions) &&
        publicTracking.contract.availableActions.some(
          (action: any) => action?.code === "CONTINUE_PAYMENT" && action?.enabled === true
        )
    ),
    true,
    "reject public tracking: continue payment action should stay enabled"
  );
  assert.equal(
    String(publicTracking?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "REJECTED",
    "reject public tracking: split paymentReadModel should be REJECTED"
  );
  logPass("reject scenario cross-lane sync");
}

async function runExpiryScenario(input: {
  customerClient: CookieClient;
  sellerClient: CookieClient;
  adminClient: CookieClient;
  buyerUserId: number;
  productId: number;
  storeId: number;
}) {
  logStep("expiry scenario: create checkout");
  const scenario = await createCheckoutOrder({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "expiry",
    storeId: input.storeId,
  });

  await Payment.update(
    {
      expiresAt: new Date(Date.now() - 60_000),
    } as any,
    {
      where: { id: scenario.paymentId } as any,
    }
  );

  logStep("expiry scenario: trigger seller read-path sync");
  const sellerExpired = await fetchSellerOrderDetail(
    input.sellerClient,
    input.storeId,
    scenario.suborderId,
    "expiry seller order detail"
  );
  assert.equal(
    String(sellerExpired?.paymentStatus || ""),
    "EXPIRED",
    "expiry seller: suborder paymentStatus should be EXPIRED"
  );
  assert.equal(
    String(sellerExpired?.paymentSummary?.status || ""),
    "EXPIRED",
    "expiry seller: payment record should be EXPIRED"
  );

  const buyerExpired = await fetchBuyerGroupedOrder(
    input.customerClient,
    scenario.orderId,
    "expiry buyer grouped view"
  );
  const buyerExpiredGroup = getSingleGroup(buyerExpired, "expiry buyer grouped view");
  assert.equal(String(buyerExpired?.paymentStatus || ""), "UNPAID", "expiry buyer: parent paymentStatus should remain UNPAID");
  assert.equal(
    String(buyerExpiredGroup?.paymentStatus || ""),
    "EXPIRED",
    "expiry buyer: suborder paymentStatus should be EXPIRED"
  );
  assert.equal(
    String(buyerExpiredGroup?.payment?.status || ""),
    "EXPIRED",
    "expiry buyer: payment record should be EXPIRED"
  );
  assert.equal(
    String(buyerExpiredGroup?.payment?.displayStatus || ""),
    "EXPIRED",
    "expiry buyer: displayStatus should be EXPIRED"
  );
  assert.equal(
    String(buyerExpiredGroup?.paymentReadModel?.status || ""),
    "EXPIRED",
    "expiry buyer: paymentReadModel should be EXPIRED"
  );

  const expiredPaymentDetail = await fetchPaymentDetail(
    input.customerClient,
    scenario.paymentId,
    "expiry payment detail"
  );
  assert.equal(
    String(expiredPaymentDetail?.readModel?.status || ""),
    "EXPIRED",
    "expiry payment detail: readModel should be EXPIRED"
  );
  assert.equal(
    Boolean(expiredPaymentDetail?.readModel?.cancelability?.canCancel),
    false,
    "expiry payment detail: cancelability should be closed"
  );

  const adminExpired = await fetchAdminAuditDetail(
    input.adminClient,
    scenario.orderId,
    "expiry admin audit detail"
  );
  const adminExpiredGroup = findAdminSplitGroup(
    adminExpired,
    scenario.suborderId,
    "expiry admin audit detail"
  );
  const adminExpiredSuborder = findAdminSuborder(
    adminExpired,
    scenario.suborderId,
    "expiry admin audit detail"
  );
  assert.equal(String(adminExpired?.parent?.paymentStatus || ""), "UNPAID", "expiry admin: parent paymentStatus should remain UNPAID");
  assert.equal(
    String(adminExpiredGroup?.payment?.status || ""),
    "EXPIRED",
    "expiry admin: split payment should be EXPIRED"
  );
  assert.equal(
    String(adminExpiredSuborder?.paymentStatus || ""),
    "EXPIRED",
    "expiry admin: suborder paymentStatus should be EXPIRED"
  );

  const adminOrderDetail = await fetchAdminOrderDetail(
    input.adminClient,
    scenario.invoiceNo,
    "expiry admin order detail"
  );
  assert.equal(
    String(adminOrderDetail?.contract?.statusSummary?.code || ""),
    "EXPIRED",
    "expiry admin order detail: statusSummary should be EXPIRED"
  );

  const publicTracking = await fetchPublicTracking(
    scenario.invoiceNo,
    "expiry public tracking"
  );
  assert.equal(
    String(publicTracking?.contract?.statusSummary?.code || ""),
    "EXPIRED",
    "expiry public tracking: statusSummary should be EXPIRED"
  );
  assert.equal(
    Boolean(
      Array.isArray(publicTracking?.contract?.availableActions) &&
        publicTracking.contract.availableActions.some(
          (action: any) => action?.code === "CONTINUE_PAYMENT" && action?.enabled === true
        )
    ),
    false,
    "expiry public tracking: continue payment action should be closed"
  );
  assert.equal(
    String(publicTracking?.storeSplits?.[0]?.paymentReadModel?.status || ""),
    "EXPIRED",
    "expiry public tracking: split paymentReadModel should be EXPIRED"
  );
  logPass("expiry scenario cross-lane sync");
}

async function runCheckoutGuardrailScenarios(input: {
  customerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  storeId: number;
}) {
  logStep("guardrail scenario: unpublished product blocks checkout");
  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  await Product.update(
    { isPublished: false } as any,
    { where: { id: input.productId } as any }
  );
  const unpublished = await expectCheckoutConflict({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "guardrail-unpublished",
    skipCartSetup: true,
  });
  assert.equal(
    String(unpublished?.data?.invalidItems?.[0]?.reason || ""),
    "PRODUCT_NOT_PUBLIC",
    "guardrail unpublished: expected PRODUCT_NOT_PUBLIC"
  );
  await Product.update(
    { isPublished: true } as any,
    { where: { id: input.productId } as any }
  );

  logStep("guardrail scenario: inactive store blocks checkout");
  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  await Store.update(
    { status: "INACTIVE" } as any,
    { where: { id: input.storeId } as any }
  );
  const inactiveStore = await expectCheckoutConflict({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "guardrail-store-inactive",
    skipCartSetup: true,
  });
  assert.equal(
    String(inactiveStore?.data?.invalidItems?.[0]?.reason || ""),
    "PRODUCT_NOT_PUBLIC",
    "guardrail store inactive: expected PRODUCT_NOT_PUBLIC"
  );
  await Store.update(
    { status: "ACTIVE" } as any,
    { where: { id: input.storeId } as any }
  );

  logStep("guardrail scenario: stock exhaustion blocks checkout");
  await addProductToCart(input.customerClient, input.buyerUserId, input.productId);
  await Product.update(
    { stock: 0 } as any,
    { where: { id: input.productId } as any }
  );
  const outOfStock = await expectCheckoutConflict({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "guardrail-out-of-stock",
    skipCartSetup: true,
  });
  assert.equal(
    String(outOfStock?.data?.invalidItems?.[0]?.reason || ""),
    "PRODUCT_OUT_OF_STOCK",
    "guardrail out of stock: expected PRODUCT_OUT_OF_STOCK"
  );
  await Product.update(
    { stock: 30 } as any,
    { where: { id: input.productId } as any }
  );

  logStep("guardrail scenario: invalid coupon blocks checkout");
  const invalidCoupon = await expectCheckoutConflict({
    customerClient: input.customerClient,
    buyerUserId: input.buyerUserId,
    productId: input.productId,
    label: "guardrail-invalid-coupon",
    couponCode: `${RUN_ID}-missing-coupon`,
  });
  assert.equal(
    String(invalidCoupon?.data?.coupon?.reason || ""),
    "not_found",
    "guardrail invalid coupon: expected not_found"
  );
  logPass("checkout guardrail conflict coverage");
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
  await ensureServerReady();
  await sequelize.authenticate();

  logStep("creating fixtures");
  const sellerUser = await createFixtureUser("seller-owner");
  const buyerUser = await createFixtureUser("buyer");
  const store = await createFixtureStore(sellerUser.id, "store");
  await createFixturePaymentProfile(store.id);
  const product = await createFixtureProduct({
    ownerUserId: sellerUser.id,
    storeId: store.id,
    label: "checkout-product",
  });

  logStep("authenticating admin, seller, and buyer clients");
  const adminClient = new CookieClient();
  const sellerClient = new CookieClient();
  const buyerClient = new CookieClient();
  await loginAdmin(adminClient);
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await login(buyerClient, buyerUser.email, buyerUser.password, "buyer login");

  await runCheckoutGuardrailScenarios({
    customerClient: buyerClient,
    buyerUserId: buyerUser.id,
    productId: product.id,
    storeId: store.id,
  });

  await runCheckoutIdempotencyScenario({
    customerClient: buyerClient,
    buyerUserId: buyerUser.id,
    productId: product.id,
    storeId: store.id,
  });

  await runApproveScenario({
    customerClient: buyerClient,
    sellerClient,
    adminClient,
    buyerUserId: buyerUser.id,
    productId: product.id,
    storeId: store.id,
  });

  await runRejectScenario({
    customerClient: buyerClient,
    sellerClient,
    adminClient,
    buyerUserId: buyerUser.id,
    productId: product.id,
    storeId: store.id,
  });

  await runExpiryScenario({
    customerClient: buyerClient,
    sellerClient,
    adminClient,
    buyerUserId: buyerUser.id,
    productId: product.id,
    storeId: store.id,
  });

  console.log("[mvf-order-payment] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-order-payment] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-order-payment] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
