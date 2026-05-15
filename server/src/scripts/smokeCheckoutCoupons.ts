import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import {
  Cart,
  CartItem,
  Coupon,
  Order,
  OrderItem,
  Payment,
  PaymentProof,
  PaymentStatusLog,
  Product,
  Store,
  StorePaymentProfile,
  Suborder,
  SuborderItem,
  User,
  sequelize,
} from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const RUN_ID = `mvf-checkout-coupon-${Date.now()}`.toLowerCase();
const PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";

const PLATFORM_CODE = `PLATC${Date.now()}`.toUpperCase();
const STORE_A_CODE = `STOREAC${Date.now()}`.toUpperCase();
const STORE_B_CODE = `STOREBC${Date.now()}`.toUpperCase();
const MIN_SPEND_CODE = `MINC${Date.now()}`.toUpperCase();
const EXPIRED_CODE = `EXPC${Date.now()}`.toUpperCase();

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
    if (this.cookie) headers.set("Cookie", this.cookie);

    const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
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

const logStep = (label: string) => console.log(`[mvf-checkout-coupons] ${label}`);
const logPass = (label: string) => console.log(`[mvf-checkout-coupons] PASS ${label}`);

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

async function fetchJson(path: string, init: RequestInit = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { response, body, text };
}

async function ensureServerReady() {
  const { response, text } = await fetchJson("/api/health");
  assert.equal(response.ok, true, `API not ready at ${BASE_URL}/api/health (${text})`);
}

async function createUser(label: string, role = "customer") {
  const password = PASSWORD;
  const user = await User.create({
    name: `${RUN_ID} ${label}`,
    email: `${RUN_ID}-${label}@local.dev`,
    password: await bcrypt.hash(password, 10),
    role,
    status: "active",
  } as any);
  createdUserIds.push(Number((user as any).id));
  return { id: Number((user as any).id), email: String((user as any).email), password };
}

async function createStore(ownerUserId: number, label: string) {
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID} ${label}`,
    slug: slugify(`${RUN_ID}-${label}`),
    status: "ACTIVE",
  } as any);
  createdStoreIds.push(Number((store as any).id));
  return { id: Number((store as any).id), slug: String((store as any).slug) };
}

async function createPaymentProfile(storeId: number) {
  const now = new Date();
  const profile = await StorePaymentProfile.create({
    storeId,
    providerCode: "MANUAL_QRIS",
    paymentType: "QRIS_STATIC",
    version: 1,
    snapshotStatus: "ACTIVE",
    accountName: `${RUN_ID} Account ${storeId}`,
    merchantName: `${RUN_ID} Merchant ${storeId}`,
    merchantId: `${RUN_ID}-${storeId}`,
    qrisImageUrl: `https://example.com/${RUN_ID}-${storeId}.png`,
    qrisPayload: `${RUN_ID}-${storeId}-payload`,
    instructionText: "Transfer exactly the shown amount.",
    isActive: true,
    verificationStatus: "ACTIVE",
    verifiedAt: now,
    activatedAt: now,
  } as any);
  const id = Number((profile as any).id);
  createdPaymentProfileIds.push(id);
  await Store.update(
    { activeStorePaymentProfileId: id } as any,
    { where: { id: storeId } as any }
  );
  return { id };
}

async function createProduct(input: { ownerUserId: number; storeId: number; label: string; price: number }) {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: input.price,
    salePrice: null,
    stock: 50,
    userId: input.ownerUserId,
    storeId: input.storeId,
    status: "active",
    isPublished: true,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
    promoImagePath: "/uploads/products/demo.svg",
    imagePaths: ["/uploads/products/demo.svg"],
  } as any);
  const id = Number((product as any).id);
  createdProductIds.push(id);
  return { id, slug, price: input.price };
}

async function seedCoupons(storeAId: number, storeBId: number) {
  const now = Date.now();
  await Coupon.bulkCreate([
    {
      code: PLATFORM_CODE,
      campaignName: PLATFORM_CODE,
      discountType: "percent",
      amount: 10,
      minSpend: 5000,
      active: true,
      scopeType: "PLATFORM",
      storeId: null,
      startsAt: new Date(now - 60_000),
      expiresAt: new Date(now + 86_400_000),
    },
    {
      code: STORE_A_CODE,
      campaignName: STORE_A_CODE,
      discountType: "fixed",
      amount: 1500,
      minSpend: 5000,
      active: true,
      scopeType: "STORE",
      storeId: storeAId,
      startsAt: new Date(now - 60_000),
      expiresAt: new Date(now + 86_400_000),
    },
    {
      code: STORE_B_CODE,
      campaignName: STORE_B_CODE,
      discountType: "percent",
      amount: 20,
      minSpend: 5000,
      active: true,
      scopeType: "STORE",
      storeId: storeBId,
      startsAt: new Date(now - 60_000),
      expiresAt: new Date(now + 86_400_000),
    },
    {
      code: MIN_SPEND_CODE,
      campaignName: MIN_SPEND_CODE,
      discountType: "fixed",
      amount: 1000,
      minSpend: 999999,
      active: true,
      scopeType: "PLATFORM",
      storeId: null,
      startsAt: new Date(now - 60_000),
      expiresAt: new Date(now + 86_400_000),
    },
    {
      code: EXPIRED_CODE,
      campaignName: EXPIRED_CODE,
      discountType: "percent",
      amount: 30,
      minSpend: 0,
      active: true,
      scopeType: "PLATFORM",
      storeId: null,
      startsAt: new Date(now - 86_400_000),
      expiresAt: new Date(now - 60_000),
    },
  ] as any);
}

async function login(client: CookieClient, email: string, password: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assert.equal(response.status, 200, `login failed ${response.text}`);
}

async function resetCart(userId: number) {
  const carts = await Cart.findAll({ where: { userId } as any, attributes: ["id"] });
  const cartIds = carts
    .map((cart: any) => Number(cart?.id || cart?.get?.("id") || 0))
    .filter((id) => id > 0);
  if (cartIds.length > 0) {
    await CartItem.destroy({ where: { cartId: { [Op.in]: cartIds } } as any });
    await Cart.destroy({ where: { id: { [Op.in]: cartIds } } as any });
  }
}

async function addToCart(client: CookieClient, productId: number, quantity: number) {
  const response = await client.request("/api/cart/add", {
    method: "POST",
    body: JSON.stringify({ productId, quantity }),
  });
  assert.equal(response.status, 200, `add to cart failed ${response.text}`);
}

const shippingDetails = (label: string) => ({
  fullName: `${RUN_ID} ${label}`,
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
});

async function createCheckout(
  client: CookieClient,
  label: string,
  payload: Record<string, unknown>
) {
  const details = shippingDetails(label);
  const response = await client.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        name: details.fullName,
        phone: details.phoneNumber,
        address: `${details.streetName} ${details.houseNumber}`,
        notes: `Smoke ${label}`,
      },
      shippingDetails: details,
      checkoutRequestKey: `${RUN_ID}-${label}`,
      ...payload,
    }),
  });
  return response;
}

async function previewCheckout(client: CookieClient, label: string) {
  const response = await client.request("/api/checkout/preview", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assert.equal(response.status, 200, `${label}: preview failed ${response.text}`);
  assert.equal(Boolean(response.body?.success), true, `${label}: preview missing success`);
  return response.body?.data ?? null;
}

function assertPreviewTotals(input: {
  label: string;
  preview: any;
  subtotalAmount: number;
  shippingAmount: number;
  grandTotal: number;
  groupTotals: Array<{ storeId: number; subtotalAmount: number; shippingAmount: number; totalAmount: number }>;
}) {
  assert.equal(
    toNumber(input.preview?.summary?.subtotalAmount),
    input.subtotalAmount,
    `${input.label}: preview subtotal mismatch`
  );
  assert.equal(
    toNumber(input.preview?.summary?.shippingAmount),
    input.shippingAmount,
    `${input.label}: preview shipping mismatch`
  );
  assert.equal(
    toNumber(input.preview?.summary?.grandTotal),
    input.grandTotal,
    `${input.label}: preview grand total mismatch`
  );

  const groupsByStore = new Map(
    (Array.isArray(input.preview?.groups) ? input.preview.groups : []).map((group: any) => [
      toNumber(group?.storeId),
      group,
    ])
  );
  assert.equal(groupsByStore.size, input.groupTotals.length, `${input.label}: preview group count mismatch`);
  for (const expected of input.groupTotals) {
    const group = groupsByStore.get(expected.storeId) as any;
    assert.ok(group, `${input.label}: preview group missing for store ${expected.storeId}`);
    assert.equal(
      toNumber(group?.subtotalAmount),
      expected.subtotalAmount,
      `${input.label}: preview group subtotal mismatch for store ${expected.storeId}`
    );
    assert.equal(
      toNumber(group?.shippingAmount),
      expected.shippingAmount,
      `${input.label}: preview group shipping mismatch for store ${expected.storeId}`
    );
    assert.equal(
      toNumber(group?.totalAmount),
      expected.totalAmount,
      `${input.label}: preview group total mismatch for store ${expected.storeId}`
    );
  }
}

function assertCheckoutResponseTotals(input: {
  label: string;
  data: any;
  subtotalAmount: number;
  shippingAmount: number;
  grandTotal: number;
  groupTotals: Array<{ storeId: number; totalAmount: number; paymentAmount: number }>;
}) {
  assert.equal(
    toNumber(input.data?.summary?.subtotalAmount),
    input.subtotalAmount,
    `${input.label}: response summary subtotal mismatch`
  );
  assert.equal(
    toNumber(input.data?.summary?.shippingAmount),
    input.shippingAmount,
    `${input.label}: response summary shipping mismatch`
  );
  assert.equal(
    toNumber(input.data?.summary?.grandTotal),
    input.grandTotal,
    `${input.label}: response summary grand total mismatch`
  );

  const groupsByStore = new Map(
    (Array.isArray(input.data?.groups) ? input.data.groups : []).map((group: any) => [
      toNumber(group?.storeId),
      group,
    ])
  );
  assert.equal(groupsByStore.size, input.groupTotals.length, `${input.label}: response group count mismatch`);
  for (const expected of input.groupTotals) {
    const group = groupsByStore.get(expected.storeId) as any;
    assert.ok(group, `${input.label}: response group missing for store ${expected.storeId}`);
    assert.equal(
      toNumber(group?.totalAmount),
      expected.totalAmount,
      `${input.label}: response group total mismatch for store ${expected.storeId}`
    );
    assert.equal(
      toNumber(group?.payment?.amount),
      expected.paymentAmount,
      `${input.label}: response payment amount mismatch for store ${expected.storeId}`
    );
  }
}

async function loadOrder(orderId: number) {
  const order = await Order.findByPk(orderId, {
    include: [
      { model: Suborder, as: "suborders", include: [{ model: Payment, as: "payments" }] },
      { model: OrderItem, as: "items" },
    ],
  });
  assert.ok(order, `order ${orderId} not found`);
  return order as any;
}

async function assertOrderTotals(input: {
  orderId: number;
  couponCode: string | null;
  discountAmount: number;
  totalAmount: number;
  suborderCount: number;
}) {
  const order = await loadOrder(input.orderId);
  assert.equal(String(order.get("couponCode") || ""), input.couponCode || "", "order couponCode mismatch");
  assert.equal(toNumber(order.get("discountAmount")), input.discountAmount, "order discount mismatch");
  assert.equal(toNumber(order.get("totalAmount")), input.totalAmount, "order total mismatch");
  assert.equal((order.suborders || []).length, input.suborderCount, "suborder count mismatch");
  const suborderTotal = (order.suborders || []).reduce(
    (sum: number, suborder: any) => sum + toNumber(suborder.get("totalAmount")),
    0
  );
  assert.equal(suborderTotal, input.totalAmount, "suborder totals should sum to order total");
  const paymentTotal = (order.suborders || []).reduce(
    (sum: number, suborder: any) =>
      sum +
      (Array.isArray(suborder.payments)
        ? suborder.payments.reduce(
            (inner: number, payment: any) => inner + toNumber(payment.get("amount")),
            0
          )
        : 0),
    0
  );
  assert.equal(paymentTotal, input.totalAmount, "payment amounts should sum to order total");
  return order;
}

async function runSingleStoreCouponScenario(input: {
  buyerClient: CookieClient;
  buyerUserId: number;
  productId: number;
  code: string;
  expectedDiscount: number;
  expectedTotal: number;
  expectedScope: "PLATFORM" | "STORE";
  label: string;
}) {
  await resetCart(input.buyerUserId);
  await addToCart(input.buyerClient, input.productId, 2);
  const preview = await previewCheckout(input.buyerClient, `${input.label} preview`);
  assertPreviewTotals({
    label: input.label,
    preview,
    subtotalAmount: 20000,
    shippingAmount: 0,
    grandTotal: 20000,
    groupTotals: [
      {
        storeId: toNumber(preview?.groups?.[0]?.storeId),
        subtotalAmount: 20000,
        shippingAmount: 0,
        totalAmount: 20000,
      },
    ],
  });
  const previewGroup = Array.isArray(preview?.groups) ? preview.groups[0] : null;
  const quote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({
      code: input.code,
      subtotal: toNumber(previewGroup?.subtotalAmount),
      shipping: toNumber(previewGroup?.shippingAmount),
      storeId: toNumber(previewGroup?.storeId),
    }),
  });
  assert.equal(quote.response.status, 200, `${input.label}: quote failed ${quote.text}`);
  assert.equal(Boolean(quote.body?.valid), true, `${input.label}: quote should be valid`);
  assert.equal(toNumber(quote.body?.discount), input.expectedDiscount, `${input.label}: quote discount mismatch`);
  assert.equal(toNumber(quote.body?.total), input.expectedTotal, `${input.label}: quote total mismatch`);

  const checkout = await createCheckout(input.buyerClient, input.label, {
    couponCode: input.code,
  });
  assert.equal(checkout.status, 201, `${input.label}: checkout failed ${checkout.text}`);
  const orderId = toNumber(checkout.body?.data?.orderId, 0);
  assert.ok(orderId > 0, `${input.label}: orderId missing`);
  createdOrderIds.push(orderId);
  assertCheckoutResponseTotals({
    label: input.label,
    data: checkout.body?.data,
    subtotalAmount: 20000,
    shippingAmount: 0,
    grandTotal: input.expectedTotal,
    groupTotals: [
      {
        storeId: toNumber(previewGroup?.storeId),
        totalAmount: input.expectedTotal,
        paymentAmount: input.expectedTotal,
      },
    ],
  });

  const order = await assertOrderTotals({
    orderId,
    couponCode: input.code,
    discountAmount: input.expectedDiscount,
    totalAmount: input.expectedTotal,
    suborderCount: 1,
  });
  const suborder = order.suborders[0];
  assert.equal(String(suborder.get("appliedCouponCode") || ""), input.code, `${input.label}: suborder coupon`);
  assert.equal(
    String(suborder.get("appliedCouponScopeType") || ""),
    input.expectedScope,
    `${input.label}: suborder coupon scope`
  );
  assert.equal(toNumber(suborder.get("totalAmount")), input.expectedTotal, `${input.label}: suborder total`);
  assert.equal(toNumber(suborder.payments?.[0]?.get?.("amount")), input.expectedTotal, `${input.label}: payment amount`);
}

async function cleanupFixtures() {
  for (const userId of createdUserIds) {
    await resetCart(userId).catch(() => null);
  }

  if (createdOrderIds.length > 0) {
    const suborders = await Suborder.findAll({
      where: { orderId: { [Op.in]: createdOrderIds } } as any,
      attributes: ["id"],
    }).catch(() => []);
    const suborderIds = (Array.isArray(suborders) ? suborders : [])
      .map((row: any) => toNumber(row?.id || row?.get?.("id"), 0))
      .filter((id) => id > 0);
    const payments = suborderIds.length
      ? await Payment.findAll({
          where: { suborderId: { [Op.in]: suborderIds } } as any,
          attributes: ["id"],
        }).catch(() => [])
      : [];
    const paymentIds = (Array.isArray(payments) ? payments : [])
      .map((row: any) => toNumber(row?.id || row?.get?.("id"), 0))
      .filter((id) => id > 0);
    if (paymentIds.length > 0) {
      await PaymentStatusLog.destroy({ where: { paymentId: { [Op.in]: paymentIds } } as any, force: true }).catch(() => null);
      await PaymentProof.destroy({ where: { paymentId: { [Op.in]: paymentIds } } as any, force: true }).catch(() => null);
      await Payment.destroy({ where: { id: { [Op.in]: paymentIds } } as any, force: true }).catch(() => null);
    }
    if (suborderIds.length > 0) {
      await SuborderItem.destroy({ where: { suborderId: { [Op.in]: suborderIds } } as any, force: true }).catch(() => null);
      await Suborder.destroy({ where: { id: { [Op.in]: suborderIds } } as any, force: true }).catch(() => null);
    }
    await OrderItem.destroy({ where: { orderId: { [Op.in]: createdOrderIds } } as any, force: true }).catch(() => null);
    await Order.destroy({ where: { id: { [Op.in]: createdOrderIds } } as any, force: true }).catch(() => null);
  }

  await Coupon.destroy({
    where: { code: { [Op.in]: [PLATFORM_CODE, STORE_A_CODE, STORE_B_CODE, MIN_SPEND_CODE, EXPIRED_CODE] } } as any,
    force: true,
  }).catch(() => null);
  if (createdProductIds.length > 0) {
    await Product.destroy({ where: { id: { [Op.in]: createdProductIds } } as any, force: true }).catch(() => null);
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
    await Store.destroy({ where: { id: { [Op.in]: createdStoreIds } } as any, force: true }).catch(() => null);
  }
  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: { [Op.in]: createdUserIds } } as any, force: true }).catch(() => null);
  }
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();

  logStep("creating checkout coupon fixtures");
  const sellerA = await createUser("seller-a", "seller");
  const sellerB = await createUser("seller-b", "seller");
  const buyer = await createUser("buyer");
  const storeA = await createStore(sellerA.id, "store-a");
  const storeB = await createStore(sellerB.id, "store-b");
  await createPaymentProfile(storeA.id);
  await createPaymentProfile(storeB.id);
  const productA = await createProduct({ ownerUserId: sellerA.id, storeId: storeA.id, label: "product-a", price: 10000 });
  const productB = await createProduct({ ownerUserId: sellerB.id, storeId: storeB.id, label: "product-b", price: 8000 });
  await seedCoupons(storeA.id, storeB.id);
  logPass("fixtures ready");

  const buyerClient = new CookieClient();
  await login(buyerClient, buyer.email, buyer.password);

  logStep("verifying public quote truth");
  const platformQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({ code: PLATFORM_CODE, subtotal: 20000, shipping: 0, storeId: storeA.id }),
  });
  assert.equal(platformQuote.response.status, 200, platformQuote.text);
  assert.equal(Boolean(platformQuote.body?.valid), true, "platform quote should be valid");
  assert.equal(Number(platformQuote.body?.discount), 2000, "platform quote discount mismatch");
  const storeQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({ code: STORE_A_CODE, subtotal: 20000, shipping: 0, storeId: storeA.id }),
  });
  assert.equal(Boolean(storeQuote.body?.valid), true, "store quote should be valid");
  assert.equal(Number(storeQuote.body?.discount), 1500, "store quote discount mismatch");
  const minSpendQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({ code: MIN_SPEND_CODE, subtotal: 20000, shipping: 0, storeId: storeA.id }),
  });
  assert.equal(Boolean(minSpendQuote.body?.valid), false, "min spend quote should be invalid");
  assert.equal(String(minSpendQuote.body?.reason || ""), "minSpend", "min spend reason mismatch");
  const expiredQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({ code: EXPIRED_CODE, subtotal: 20000, shipping: 0, storeId: storeA.id }),
  });
  assert.equal(Boolean(expiredQuote.body?.valid), false, "expired quote should be invalid");
  assert.equal(String(expiredQuote.body?.reason || ""), "expired", "expired reason mismatch");
  logPass("public quote truth");

  logStep("verifying single-store platform coupon order attribution");
  await runSingleStoreCouponScenario({
    buyerClient,
    buyerUserId: buyer.id,
    productId: productA.id,
    code: PLATFORM_CODE,
    expectedDiscount: 2000,
    expectedTotal: 18000,
    expectedScope: "PLATFORM",
    label: "single-platform",
  });
  logPass("single-store platform coupon order attribution");

  logStep("verifying single-store seller coupon order attribution");
  await runSingleStoreCouponScenario({
    buyerClient,
    buyerUserId: buyer.id,
    productId: productA.id,
    code: STORE_A_CODE,
    expectedDiscount: 1500,
    expectedTotal: 18500,
    expectedScope: "STORE",
    label: "single-store-coupon",
  });
  logPass("single-store seller coupon order attribution");

  logStep("verifying wrong-store coupon is rejected at checkout");
  await resetCart(buyer.id);
  await addToCart(buyerClient, productA.id, 2);
  const wrongStore = await createCheckout(buyerClient, "wrong-store-coupon", {
    couponCode: STORE_B_CODE,
  });
  assert.equal(wrongStore.status, 409, `wrong-store coupon should fail ${wrongStore.text}`);
  assert.equal(String(wrongStore.body?.data?.coupon?.reason || ""), "scope_mismatch", "wrong-store reason mismatch");
  logPass("wrong-store coupon rejected");

  logStep("verifying min-spend and expired coupons are rejected at checkout");
  await resetCart(buyer.id);
  await addToCart(buyerClient, productA.id, 2);
  const minSpendCheckout = await createCheckout(buyerClient, "min-spend-coupon", {
    couponCode: MIN_SPEND_CODE,
  });
  assert.equal(minSpendCheckout.status, 409, `min-spend coupon should fail ${minSpendCheckout.text}`);
  assert.equal(String(minSpendCheckout.body?.data?.coupon?.reason || ""), "minSpend", "min-spend checkout reason mismatch");
  await resetCart(buyer.id);
  await addToCart(buyerClient, productA.id, 2);
  const expiredCheckout = await createCheckout(buyerClient, "expired-coupon", {
    couponCode: EXPIRED_CODE,
  });
  assert.equal(expiredCheckout.status, 409, `expired coupon should fail ${expiredCheckout.text}`);
  assert.equal(String(expiredCheckout.body?.data?.coupon?.reason || ""), "expired", "expired checkout reason mismatch");
  logPass("min-spend and expired coupons rejected");

  logStep("verifying multi-store group coupon totals and attribution");
  await resetCart(buyer.id);
  await addToCart(buyerClient, productA.id, 2);
  await addToCart(buyerClient, productB.id, 1);
  const multiPreview = await previewCheckout(buyerClient, "multi-store group coupons preview");
  assertPreviewTotals({
    label: "multi-store group coupons",
    preview: multiPreview,
    subtotalAmount: 28000,
    shippingAmount: 0,
    grandTotal: 28000,
    groupTotals: [
      {
        storeId: storeA.id,
        subtotalAmount: 20000,
        shippingAmount: 0,
        totalAmount: 20000,
      },
      {
        storeId: storeB.id,
        subtotalAmount: 8000,
        shippingAmount: 0,
        totalAmount: 8000,
      },
    ],
  });
  const multiGroupsByStore = new Map(
    (Array.isArray(multiPreview?.groups) ? multiPreview.groups : []).map((group: any) => [
      toNumber(group?.storeId),
      group,
    ])
  );
  const storeAQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({
      code: STORE_A_CODE,
      subtotal: toNumber((multiGroupsByStore.get(storeA.id) as any)?.subtotalAmount),
      shipping: toNumber((multiGroupsByStore.get(storeA.id) as any)?.shippingAmount),
      storeId: storeA.id,
    }),
  });
  assert.equal(Boolean(storeAQuote.body?.valid), true, "store A group quote should be valid");
  assert.equal(toNumber(storeAQuote.body?.discount), 1500, "store A group quote discount mismatch");
  assert.equal(toNumber(storeAQuote.body?.total), 18500, "store A group quote total mismatch");
  const storeBQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({
      code: STORE_B_CODE,
      subtotal: toNumber((multiGroupsByStore.get(storeB.id) as any)?.subtotalAmount),
      shipping: toNumber((multiGroupsByStore.get(storeB.id) as any)?.shippingAmount),
      storeId: storeB.id,
    }),
  });
  assert.equal(Boolean(storeBQuote.body?.valid), true, "store B group quote should be valid");
  assert.equal(toNumber(storeBQuote.body?.discount), 1600, "store B group quote discount mismatch");
  assert.equal(toNumber(storeBQuote.body?.total), 6400, "store B group quote total mismatch");
  const multiStore = await createCheckout(buyerClient, "multi-store-group-coupons", {
    groupCoupons: [
      { storeId: storeA.id, couponCode: STORE_A_CODE },
      { storeId: storeB.id, couponCode: STORE_B_CODE },
    ],
  });
  assert.equal(multiStore.status, 201, `multi-store group coupons failed ${multiStore.text}`);
  const multiOrderId = toNumber(multiStore.body?.data?.orderId, 0);
  assert.ok(multiOrderId > 0, "multi-store orderId missing");
  createdOrderIds.push(multiOrderId);
  assertCheckoutResponseTotals({
    label: "multi-store group coupons",
    data: multiStore.body?.data,
    subtotalAmount: 28000,
    shippingAmount: 0,
    grandTotal: 24900,
    groupTotals: [
      { storeId: storeA.id, totalAmount: 18500, paymentAmount: 18500 },
      { storeId: storeB.id, totalAmount: 6400, paymentAmount: 6400 },
    ],
  });
  const multiOrder = await assertOrderTotals({
    orderId: multiOrderId,
    couponCode: null,
    discountAmount: 3100,
    totalAmount: 24900,
    suborderCount: 2,
  });
  const subordersByStore = new Map(
    (multiOrder.suborders || []).map((suborder: any) => [toNumber(suborder.get("storeId")), suborder])
  );
  const suborderA = subordersByStore.get(storeA.id) as any;
  const suborderB = subordersByStore.get(storeB.id) as any;
  assert.ok(suborderA, "store A suborder missing");
  assert.ok(suborderB, "store B suborder missing");
  assert.equal(String(suborderA.get("appliedCouponCode") || ""), STORE_A_CODE, "store A coupon attribution");
  assert.equal(toNumber(suborderA.get("totalAmount")), 18500, "store A discounted total");
  assert.equal(toNumber(suborderA.payments?.[0]?.get?.("amount")), 18500, "store A payment amount");
  assert.equal(String(suborderB.get("appliedCouponCode") || ""), STORE_B_CODE, "store B coupon attribution");
  assert.equal(toNumber(suborderB.get("totalAmount")), 6400, "store B discounted total");
  assert.equal(toNumber(suborderB.payments?.[0]?.get?.("amount")), 6400, "store B payment amount");
  logPass("multi-store group coupon totals and attribution");

  console.log("[mvf-checkout-coupons] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-checkout-coupons] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((error) => {
      console.error("[mvf-checkout-coupons] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
