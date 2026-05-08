import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { Coupon } from "../models/index.js";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `offers${String(Date.now()).slice(-8)}`;
const SMOKE_COUPON_CODE = `OFFERS${String(Date.now()).slice(-8)}`;
const DEFAULT_OFFERS_PAGE_TITLE = "Mega Offer";

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

const logStep = (label: string) => {
  console.log(`[mvf-offers] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-offers] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-offers] API not ready at ${BASE_URL}/api/health`);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function fetchPublicOffers() {
  const response = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=offers`
  );
  assert.equal(response.ok, true, "public offers request should succeed");
  const body = await response.json();
  assert.equal(Boolean(body?.success), true, "public offers should return success=true");
  return body?.data?.customization?.offers;
}

async function cleanup() {
  await sequelize.query("DELETE FROM store_customizations WHERE lang = :lang", {
    replacements: { lang: SMOKE_LANG },
    type: QueryTypes.DELETE,
  });
  await Coupon.destroy({
    where: { code: SMOKE_COUPON_CODE } as any,
  });
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();

  const adminClient = new CookieClient();
  await loginAdmin(adminClient);

  logStep("create valid platform coupon");
  await Coupon.create({
    code: SMOKE_COUPON_CODE,
    discountType: "percent",
    amount: 15,
    minSpend: 0,
    active: true,
    scopeType: "PLATFORM",
    startsAt: new Date(Date.now() - 60_000),
    expiresAt: new Date(Date.now() + 86_400_000),
  } as any);
  logPass("coupon seeded");

  logStep("persist offers customization");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          offers: {
            pageHeader: {
              enabled: true,
              pageTitle: "",
              backgroundImageDataUrl: "https://example.com/offers-header.png",
            },
            superDiscount: {
              enabled: true,
              activeCouponCode: SMOKE_COUPON_CODE,
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin offers update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin offers update should succeed");
  logPass("admin offers update");

  logStep("reload admin offers");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin offers reload");
  const adminOffers = reloadedAdmin.body?.data?.customization?.offers;
  assert.equal(Boolean(adminOffers?.pageHeader?.enabled), true, "admin reload should keep pageHeader enabled");
  assert.equal(
    String(adminOffers?.pageHeader?.pageTitle || ""),
    DEFAULT_OFFERS_PAGE_TITLE,
    "blank offers page title should normalize to backend default"
  );
  assert.equal(
    String(adminOffers?.superDiscount?.activeCouponCode || ""),
    SMOKE_COUPON_CODE,
    "selected coupon should persist on admin reload"
  );
  logPass("admin offers persistence");

  logStep("verify public valid coupon serialization");
  const validOffers = await fetchPublicOffers();
  assert.equal(Boolean(validOffers?.pageHeader?.enabled), true, "public payload should expose pageHeader enabled");
  assert.equal(
    String(validOffers?.pageHeader?.pageTitle || ""),
    DEFAULT_OFFERS_PAGE_TITLE,
    "public payload should expose normalized offers page title"
  );
  assert.equal(
    String(validOffers?.superDiscount?.activeCouponCode || ""),
    SMOKE_COUPON_CODE,
    "public payload should expose selected coupon code"
  );
  assert.equal(
    String(validOffers?.superDiscount?.selectionStatus || ""),
    "valid",
    "public payload should expose valid selection status"
  );
  assert.equal(
    String(validOffers?.superDiscount?.couponSnapshot?.code || ""),
    SMOKE_COUPON_CODE,
    "public payload should expose resolved coupon snapshot"
  );
  logPass("public valid coupon serialization");

  logStep("verify inactive coupon handling");
  await Coupon.update({ active: false }, { where: { code: SMOKE_COUPON_CODE } as any });
  const inactiveOffers = await fetchPublicOffers();
  assert.equal(
    String(inactiveOffers?.superDiscount?.selectionStatus || ""),
    "inactive",
    "inactive coupon should resolve to inactive selection status"
  );
  assert.equal(
    inactiveOffers?.superDiscount?.couponSnapshot,
    null,
    "inactive coupon should not expose a snapshot"
  );
  logPass("inactive coupon handling");

  logStep("verify expired coupon handling");
  await Coupon.update(
    {
      active: true,
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() - 60_000),
    },
    { where: { code: SMOKE_COUPON_CODE } as any }
  );
  const expiredOffers = await fetchPublicOffers();
  assert.equal(
    String(expiredOffers?.superDiscount?.selectionStatus || ""),
    "expired",
    "expired coupon should resolve to expired selection status"
  );
  assert.equal(
    expiredOffers?.superDiscount?.couponSnapshot,
    null,
    "expired coupon should not expose a snapshot"
  );
  logPass("expired coupon handling");

  logStep("verify deleted coupon handling");
  await Coupon.destroy({ where: { code: SMOKE_COUPON_CODE } as any });
  const deletedOffers = await fetchPublicOffers();
  assert.equal(
    String(deletedOffers?.superDiscount?.selectionStatus || ""),
    "not_found",
    "deleted coupon should resolve to not_found selection status"
  );
  assert.equal(
    deletedOffers?.superDiscount?.couponSnapshot,
    null,
    "deleted coupon should not expose a snapshot"
  );
  logPass("deleted coupon handling");

  logStep("verify clear selection behavior");
  const clearResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          offers: {
            superDiscount: {
              enabled: true,
              activeCouponCode: "ALL",
            },
          },
        },
      }),
    }
  );
  assertStatus(clearResponse, 200, "admin offers clear selection");
  const clearedOffers = await fetchPublicOffers();
  assert.equal(
    String(clearedOffers?.superDiscount?.activeCouponCode || ""),
    "ALL",
    "clear selection should persist ALL sentinel"
  );
  assert.equal(
    String(clearedOffers?.superDiscount?.selectionStatus || ""),
    "all",
    "ALL sentinel should resolve to all selection status"
  );
  assert.equal(
    clearedOffers?.superDiscount?.couponSnapshot,
    null,
    "ALL sentinel should not expose a coupon snapshot"
  );
  logPass("clear selection behavior");

  logStep("verify disabled block serialization");
  const disableResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          offers: {
            pageHeader: { enabled: false },
            superDiscount: { enabled: false, activeCouponCode: "ALL" },
          },
        },
      }),
    }
  );
  assertStatus(disableResponse, 200, "admin offers disable");
  const disabledOffers = await fetchPublicOffers();
  assert.equal(Boolean(disabledOffers?.pageHeader?.enabled), false, "pageHeader should serialize disabled");
  assert.equal(
    Boolean(disabledOffers?.superDiscount?.enabled),
    false,
    "superDiscount should serialize disabled"
  );
  logPass("disabled serialization");

  console.log("[mvf-offers] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-offers] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-offers] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
