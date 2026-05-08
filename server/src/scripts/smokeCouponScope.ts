import "dotenv/config";
import assert from "node:assert/strict";
import { Op } from "sequelize";
import { Coupon, Store, User, sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const RUN_ID = `mvf-coupon-scope-${Date.now()}`.toLowerCase();
const PLATFORM_CODE = `PLAT${Date.now()}`.toUpperCase();
const ACTIVE_STORE_CODE = `STOREA${Date.now()}`.toUpperCase();
const INACTIVE_STORE_CODE = `STOREI${Date.now()}`.toUpperCase();

const logStep = (label: string) => console.log(`[mvf-coupon-scope] ${label}`);
const logPass = (label: string) => console.log(`[mvf-coupon-scope] PASS ${label}`);

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

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

async function createStore(label: string, status: "ACTIVE" | "INACTIVE") {
  const owner = await User.create({
    name: `${RUN_ID} ${label}`,
    email: `${RUN_ID}-${label}@local.dev`,
    password: "mvf-smoke-123",
    role: "seller",
    status: "active",
  } as any);

  return Store.create({
    ownerUserId: Number((owner as any).id),
    name: `${RUN_ID} ${label}`,
    slug: slugify(`${RUN_ID}-${label}`),
    status,
  } as any);
}

async function cleanup() {
  await Coupon.destroy({
    where: {
      code: { [Op.in]: [PLATFORM_CODE, ACTIVE_STORE_CODE, INACTIVE_STORE_CODE] },
    } as any,
  });
  await Store.destroy({
    where: { slug: { [Op.like]: `${RUN_ID}%` } } as any,
  });
  await User.destroy({
    where: { email: { [Op.like]: `${RUN_ID}%@local.dev` } } as any,
  });
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();
  await cleanup();

  logStep("seed platform, active-store, and inactive-store coupons");
  const activeStore = await createStore("active", "ACTIVE");
  const inactiveStore = await createStore("inactive", "INACTIVE");
  const now = Date.now();
  const window = {
    startsAt: new Date(now - 60_000),
    expiresAt: new Date(now + 86_400_000),
  };

  await Coupon.bulkCreate([
    {
      code: PLATFORM_CODE,
      campaignName: PLATFORM_CODE,
      discountType: "percent",
      amount: 5,
      minSpend: 0,
      active: true,
      scopeType: "PLATFORM",
      storeId: null,
      ...window,
    },
    {
      code: ACTIVE_STORE_CODE,
      campaignName: ACTIVE_STORE_CODE,
      discountType: "percent",
      amount: 10,
      minSpend: 0,
      active: true,
      scopeType: "STORE",
      storeId: Number((activeStore as any).id),
      ...window,
    },
    {
      code: INACTIVE_STORE_CODE,
      campaignName: INACTIVE_STORE_CODE,
      discountType: "percent",
      amount: 20,
      minSpend: 0,
      active: true,
      scopeType: "STORE",
      storeId: Number((inactiveStore as any).id),
      ...window,
    },
  ] as any);
  logPass("fixtures seeded");

  logStep("verify active store coupon list scope");
  const activeList = await fetchJson(
    `/api/store/coupons?storeSlug=${encodeURIComponent(String((activeStore as any).slug))}`
  );
  assert.equal(activeList.response.status, 200, `active store coupon list ${activeList.text}`);
  const activeCodes = new Set(
    (Array.isArray(activeList.body?.data) ? activeList.body.data : []).map((coupon: any) =>
      String(coupon?.code || "").toUpperCase()
    )
  );
  assert.equal(activeCodes.has(PLATFORM_CODE), true, "active store list should include platform coupon");
  assert.equal(activeCodes.has(ACTIVE_STORE_CODE), true, "active store list should include its store coupon");
  assert.equal(
    activeCodes.has(INACTIVE_STORE_CODE),
    false,
    "active store list should not include inactive-store coupon"
  );
  logPass("active store list scope");

  logStep("verify inactive store coupon is not public-listed");
  const inactiveList = await fetchJson(
    `/api/store/coupons?storeSlug=${encodeURIComponent(String((inactiveStore as any).slug))}`
  );
  assert.equal(inactiveList.response.status, 200, `inactive store coupon list ${inactiveList.text}`);
  const inactiveCodes = new Set(
    (Array.isArray(inactiveList.body?.data) ? inactiveList.body.data : []).map((coupon: any) =>
      String(coupon?.code || "").toUpperCase()
    )
  );
  assert.equal(
    inactiveCodes.has(INACTIVE_STORE_CODE),
    false,
    "inactive store coupon should not be public-listed"
  );
  logPass("inactive store list filtered");

  logStep("verify active store quote accepts matching store coupon");
  const validQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({
      code: ACTIVE_STORE_CODE,
      subtotal: 2500,
      shipping: 0,
      storeSlug: (activeStore as any).slug,
    }),
  });
  assert.equal(validQuote.response.status, 200, `valid quote ${validQuote.text}`);
  assert.equal(Boolean(validQuote.body?.valid), true, "matching active store coupon should quote valid");
  assert.equal(Number(validQuote.body?.discount), 250, "10 percent discount should be calculated");
  assert.equal(String(validQuote.body?.scopeType || ""), "STORE", "quote should remain store-scoped");
  logPass("active store quote");

  logStep("verify inactive store quote rejects inactive-store coupon scope");
  const inactiveQuote = await fetchJson("/api/store/coupons/quote", {
    method: "POST",
    body: JSON.stringify({
      code: INACTIVE_STORE_CODE,
      subtotal: 2500,
      shipping: 0,
      storeSlug: (inactiveStore as any).slug,
    }),
  });
  assert.equal(inactiveQuote.response.status, 200, `inactive quote ${inactiveQuote.text}`);
  assert.equal(Boolean(inactiveQuote.body?.valid), false, "inactive store coupon quote should be invalid");
  assert.match(
    String(inactiveQuote.body?.reason || ""),
    /scope_required|scope_mismatch/,
    "inactive store quote should fail with coupon scope guard"
  );
  logPass("inactive store quote rejected");

  console.log("[mvf-coupon-scope] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-coupon-scope] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-coupon-scope] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
