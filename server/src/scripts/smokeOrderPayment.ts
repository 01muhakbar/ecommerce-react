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

async function fetchBuyerGroupedOrder(customerClient: CookieClient, orderId: number, label: string) {
  const response = await customerClient.request(`/api/orders/${orderId}/checkout-payment`);
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: buyer grouped view missing success`);
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

  const buyerPaid = await fetchBuyerGroupedOrder(
    input.customerClient,
    scenario.orderId,
    "approve buyer grouped paid view"
  );
  const buyerPaidGroup = getSingleGroup(buyerPaid, "approve buyer grouped paid view");
  assert.equal(String(buyerPaid?.paymentStatus || ""), "PAID", "approve buyer: parent paymentStatus should be PAID");
  assert.equal(String(buyerPaid?.orderStatus || ""), "processing", "approve buyer: parent orderStatus should move to processing");
  assert.equal(String(buyerPaidGroup?.paymentStatus || ""), "PAID", "approve buyer: suborder paymentStatus should be PAID");
  assert.equal(String(buyerPaidGroup?.payment?.status || ""), "PAID", "approve buyer: payment record should be PAID");

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
  logPass("approve scenario cross-lane sync");
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
