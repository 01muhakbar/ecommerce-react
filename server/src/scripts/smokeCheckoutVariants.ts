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
const RUN_ID = `mvf-variant-checkout-${Date.now()}`;

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
  console.log(`[mvf-checkout-variants] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-checkout-variants] PASS ${label}`);
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
    `[mvf-checkout-variants] API not ready at ${BASE_URL}/api/health`
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

const buildVariantCombinationKey = (selections: VariantSelection[]) =>
  selections
    .map((entry) =>
      `${entry.attributeId}:${String(entry.valueId ?? entry.value).trim().toLowerCase()}`
    )
    .join("|");

async function createFixtureVariantProduct(input: {
  ownerUserId: number;
  storeId: number;
  label: string;
}) {
  const slug = slugify(`${RUN_ID}-${input.label}`);
  const blueSelections: VariantSelection[] = [
    { attributeId: 1, attributeName: "Color", valueId: 101, value: "Blue" },
  ];
  const greenSelections: VariantSelection[] = [
    { attributeId: 1, attributeName: "Color", valueId: 102, value: "Green" },
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
    name: slug,
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
  return { id, slug, variants };
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

async function addVariantToCart(input: {
  customerClient: CookieClient;
  productId: number;
  variant: VariantRecord;
  quantity?: number;
  label: string;
}) {
  const response = await input.customerClient.request("/api/cart/add", {
    method: "POST",
    body: JSON.stringify({
      productId: input.productId,
      quantity: input.quantity ?? 1,
      variantKey: input.variant.combinationKey,
      variantSelections: input.variant.selections,
    }),
  });
  assertStatus(response, 200, input.label);
  assert.ok(response.body?.cartItem, `${input.label}: cartItem payload missing`);
}

async function fetchCart(customerClient: CookieClient, label: string) {
  const response = await customerClient.request("/api/cart");
  assertStatus(response, 200, label);
  return Array.isArray(response.body?.Products) ? response.body.Products : [];
}

async function previewCheckout(customerClient: CookieClient, label: string) {
  const response = await customerClient.request("/api/checkout/preview", {
    method: "POST",
    body: JSON.stringify({}),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: preview missing success`);
  return response.body?.data ?? null;
}

async function createCheckout(customerClient: CookieClient, label: string) {
  const shippingDetails = buildShippingDetails(label);
  const response = await customerClient.request("/api/checkout/create-multi-store", {
    method: "POST",
    body: JSON.stringify({
      customer: {
        name: shippingDetails.fullName,
        phone: shippingDetails.phoneNumber,
        address: `${shippingDetails.streetName} ${shippingDetails.houseNumber}`,
        notes: `Smoke ${label}`,
      },
      shippingDetails,
    }),
  });
  assertStatus(response, 201, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: create checkout missing success`);
  return response.body?.data ?? null;
}

async function fetchBuyerOrderDetail(customerClient: CookieClient, orderId: number, label: string) {
  const response = await customerClient.request(`/api/store/orders/my/${orderId}`);
  assertStatus(response, 200, label);
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

const sortByVariantLabel = (items: any[]) =>
  [...items].sort((left, right) =>
    String(left?.variantLabel || "").localeCompare(String(right?.variantLabel || ""))
  );

const normalizeCartSnapshotItems = (products: any[]) =>
  products.map((product: any) => {
    const cartItem = product?.CartItem ?? product?.cartItem ?? {};
    return {
      productId: toNumber(product?.id, 0),
      variantKey: String(cartItem?.variantKey || "").trim() || null,
      variantLabel: String(cartItem?.variantLabel || "").trim() || null,
      variantSelections: Array.isArray(cartItem?.variantSelections)
        ? cartItem.variantSelections
        : [],
    };
  });

const normalizeVariantSelectionsSnapshot = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeVariationState = (value: unknown) => {
  if (!value) return { hasVariants: false, variants: [] as any[] };
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return { hasVariants: false, variants: [] as any[] };
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object"
        ? {
            hasVariants: Boolean((parsed as any).hasVariants),
            variants: Array.isArray((parsed as any).variants) ? (parsed as any).variants : [],
          }
        : { hasVariants: false, variants: [] as any[] };
    } catch {
      return { hasVariants: false, variants: [] as any[] };
    }
  }
  return {
    hasVariants: Boolean((value as any).hasVariants),
    variants: Array.isArray((value as any).variants) ? (value as any).variants : [],
  };
};

const assertVariantSnapshotItems = (
  items: any[],
  expectedVariants: VariantRecord[],
  label: string
) => {
  assert.equal(items.length, expectedVariants.length, `${label}: item count mismatch`);
  const actual = sortByVariantLabel(items);
  const expected = sortByVariantLabel(expectedVariants);

  actual.forEach((item, index) => {
    const variant = expected[index];
    assert.equal(
      String(item?.variantKey || ""),
      variant.combinationKey,
      `${label}: variantKey mismatch for ${variant.combination}`
    );
    assert.equal(
      String(item?.variantLabel || ""),
      variant.combination,
      `${label}: variantLabel mismatch for ${variant.combination}`
    );
    assert.deepEqual(
      normalizeVariantSelectionsSnapshot(item?.variantSelections),
      variant.selections,
      `${label}: variantSelections mismatch for ${variant.combination}`
    );
  });
};

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
  const store = await createFixtureStore(sellerUser.id, "variant-store");
  await createFixturePaymentProfile(store.id);
  const product = await createFixtureVariantProduct({
    ownerUserId: sellerUser.id,
    storeId: store.id,
    label: "variant-product",
  });

  logStep("authenticating clients");
  const adminClient = new CookieClient();
  const sellerClient = new CookieClient();
  const buyerClient = new CookieClient();
  await loginAdmin(adminClient);
  await login(sellerClient, sellerUser.email, sellerUser.password, "seller login");
  await login(buyerClient, buyerUser.email, buyerUser.password, "buyer login");

  logStep("adding two variants of the same product to cart");
  await resetCartForUser(buyerUser.id);
  await addVariantToCart({
    customerClient: buyerClient,
    productId: product.id,
    variant: product.variants[0],
    label: "add blue variant",
  });
  await addVariantToCart({
    customerClient: buyerClient,
    productId: product.id,
    variant: product.variants[1],
    label: "add green variant",
  });

  const cartItems = await fetchCart(buyerClient, "fetch cart");
  assert.equal(cartItems.length, 2, "variant cart: expected two cart lines");
  assertVariantSnapshotItems(
    normalizeCartSnapshotItems(cartItems),
    product.variants,
    "variant cart snapshot"
  );
  logPass("cart stores two variants of the same product separately");

  logStep("previewing checkout");
  const preview = await previewCheckout(buyerClient, "variant checkout preview");
  const previewGroups = Array.isArray(preview?.groups) ? preview.groups : [];
  assert.equal(previewGroups.length, 1, "variant checkout preview: expected one store group");
  const previewItems = Array.isArray(previewGroups[0]?.items) ? previewGroups[0].items : [];
  assert.equal(previewItems.length, 2, "variant checkout preview: expected two preview items");
  assertVariantSnapshotItems(previewItems, product.variants, "variant checkout preview snapshot");
  logPass("checkout preview keeps both variant lines");

  logStep("creating checkout order");
  const checkoutOrder = await createCheckout(buyerClient, "variant checkout create");
  const orderId = toNumber(checkoutOrder?.orderId, 0);
  const invoiceNo = String(checkoutOrder?.invoiceNo || checkoutOrder?.ref || "");
  assert.ok(orderId > 0, "variant checkout create: orderId missing");
  assert.ok(invoiceNo, "variant checkout create: invoiceNo missing");
  createdOrderIds.push(orderId);
  const checkoutGroups = Array.isArray(checkoutOrder?.groups) ? checkoutOrder.groups : [];
  assert.equal(checkoutGroups.length, 1, "variant checkout create: expected one store group");
  const checkoutItems = Array.isArray(checkoutGroups[0]?.items) ? checkoutGroups[0].items : [];
  assert.equal(checkoutItems.length, 2, "variant checkout create: expected two order items");
  assertVariantSnapshotItems(checkoutItems, product.variants, "variant checkout create snapshot");
  const suborderId = toNumber(checkoutGroups[0]?.suborderId, 0);
  assert.ok(suborderId > 0, "variant checkout create: suborderId missing");
  logPass("checkout create keeps two variant lines");

  const storedOrderItems = await OrderItem.findAll({
    where: { orderId } as any,
    order: [["id", "ASC"]],
  });
  assertVariantSnapshotItems(storedOrderItems as any[], product.variants, "stored OrderItems snapshot");

  const storedSuborderItems = await SuborderItem.findAll({
    where: { suborderId } as any,
    order: [["id", "ASC"]],
  });
  assertVariantSnapshotItems(
    storedSuborderItems as any[],
    product.variants,
    "stored SuborderItems snapshot"
  );

  const refreshedProduct = await Product.findByPk(product.id);
  const refreshedVariationState = normalizeVariationState((refreshedProduct as any)?.variations);
  const refreshedVariations = refreshedVariationState.variants;
  const blueQuantity = toNumber(
    refreshedVariations.find(
      (entry: any) => String(entry?.combinationKey || "") === product.variants[0].combinationKey
    )?.quantity,
    0
  );
  const greenQuantity = toNumber(
    refreshedVariations.find(
      (entry: any) => String(entry?.combinationKey || "") === product.variants[1].combinationKey
    )?.quantity,
    0
  );
  assert.equal(blueQuantity, product.variants[0].quantity - 1, "blue variant quantity should decrement");
  assert.equal(greenQuantity, product.variants[1].quantity - 1, "green variant quantity should decrement");
  logPass("variant stock snapshots persist through checkout create");

  logStep("verifying buyer, seller, and admin order detail snapshots");
  const buyerDetail = await fetchBuyerOrderDetail(buyerClient, orderId, "buyer order detail");
  assertVariantSnapshotItems(
    Array.isArray(buyerDetail?.items) ? buyerDetail.items : [],
    product.variants,
    "buyer order detail snapshot"
  );

  const sellerDetail = await fetchSellerOrderDetail(
    sellerClient,
    store.id,
    suborderId,
    "seller order detail"
  );
  assertVariantSnapshotItems(
    Array.isArray(sellerDetail?.items) ? sellerDetail.items : [],
    product.variants,
    "seller order detail snapshot"
  );

  const adminDetail = await fetchAdminOrderDetail(
    adminClient,
    invoiceNo,
    "admin order detail"
  );
  assertVariantSnapshotItems(
    Array.isArray(adminDetail?.items) ? adminDetail.items : [],
    product.variants,
    "admin order detail snapshot"
  );
  logPass("buyer seller admin order detail snapshot stays in sync");

  console.log("[mvf-checkout-variants] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-checkout-variants] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-checkout-variants] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
