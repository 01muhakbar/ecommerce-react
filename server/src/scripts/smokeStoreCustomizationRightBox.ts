import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `rbx${String(Date.now()).slice(-8)}`;
const DEFAULT_RIGHT_BOX_DESCRIPTIONS = [
  "Free shipping applies to all orders over shipping €100",
  "Home Delivery within 1 Hour",
  "Cash on Delivery Available",
  "7 Days returns money back guarantee",
  "Warranty not available for this item",
  "Guaranteed 100% organic from natural products.",
  "Delivery from our pick point Boho One, Bridge Street West, Middlesbrough, North Yorkshire, TS2 1AE.",
];

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
  console.log(`[mvf-right-box] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-right-box] PASS ${label}`);
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
    `[mvf-right-box] API not ready at ${BASE_URL}/api/health`
  );
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function cleanup() {
  await sequelize.query("DELETE FROM store_customizations WHERE lang = :lang", {
    replacements: { lang: SMOKE_LANG },
    type: QueryTypes.DELETE,
  });
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();

  const adminClient = new CookieClient();
  await loginAdmin(adminClient);

  logStep("load admin customization defaults");
  const initialAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(initialAdmin, 200, "admin customization load");
  assert.equal(Boolean(initialAdmin.body?.success), true, "admin customization load should succeed");
  const initialRightBox = initialAdmin.body?.data?.customization?.productSlugPage?.rightBox;
  assert.equal(typeof initialRightBox, "object", "initial rightBox should exist in admin payload");
  logPass("admin right box default load");

  logStep("persist right box for smoke language");
  const descriptions = [
    "Smoke right box one",
    "Smoke right box two",
    "",
    "Smoke right box four",
    "",
    "",
    "Smoke right box seven",
  ];
  const normalizedDescriptions = [
    "Smoke right box one",
    "Smoke right box two",
    DEFAULT_RIGHT_BOX_DESCRIPTIONS[2],
    "Smoke right box four",
    DEFAULT_RIGHT_BOX_DESCRIPTIONS[4],
    DEFAULT_RIGHT_BOX_DESCRIPTIONS[5],
    "Smoke right box seven",
  ];
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          productSlugPage: {
            rightBox: {
              enabled: true,
              descriptions,
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin customization update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin customization update should succeed");
  logPass("admin right box update");

  logStep("reload admin customization and verify persistence");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin customization reload");
  const reloadedRightBox = reloadedAdmin.body?.data?.customization?.productSlugPage?.rightBox;
  assert.equal(Boolean(reloadedRightBox?.enabled), true, "admin reload should keep enabled=true");
  assert.deepEqual(
    reloadedRightBox?.descriptions,
    normalizedDescriptions,
    "admin reload should apply the existing fallback normalization for blank descriptions"
  );
  logPass("admin right box persistence");

  logStep("verify public payload serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(
      SMOKE_LANG
    )}&include=product-slug-page`
  );
  assert.equal(publicResponse.ok, true, "public customization request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public customization should return success=true");
  const publicRightBox = publicBody?.data?.customization?.productSlugPage?.rightBox;
  assert.equal(Boolean(publicRightBox?.enabled), true, "public payload should expose enabled=true");
  assert.deepEqual(
    publicRightBox?.descriptions,
    normalizedDescriptions,
    "public payload should expose the normalized right box descriptions"
  );
  logPass("public right box serialization");

  logStep("verify disabled state remains serializable");
  const disableResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          productSlugPage: {
            rightBox: {
              enabled: false,
            },
          },
        },
      }),
    }
  );
  assertStatus(disableResponse, 200, "admin right box disable");
  const disabledPublic = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(
      SMOKE_LANG
    )}&include=product-slug-page`
  );
  assert.equal(disabledPublic.ok, true, "public disabled right box request should succeed");
  const disabledPublicBody = await disabledPublic.json();
  assert.equal(
    Boolean(disabledPublicBody?.data?.customization?.productSlugPage?.rightBox?.enabled),
    false,
    "public payload should expose enabled=false after disable"
  );
  logPass("right box disabled serialization");

  console.log("[mvf-right-box] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-right-box] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-right-box] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
