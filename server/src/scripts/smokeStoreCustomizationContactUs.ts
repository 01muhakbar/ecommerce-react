import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `contact${String(Date.now()).slice(-8)}`;
const DEFAULT_CONTACT_PAGE_TITLE = "Contact Us";
const DEFAULT_EMAIL_BOX_TITLE = "Email Us";

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
  console.log(`[mvf-contact] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-contact] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-contact] API not ready at ${BASE_URL}/api/health`);
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

  logStep("persist contact us customization");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          contactUs: {
            pageHeader: {
              enabled: true,
              pageTitle: "",
              backgroundImageDataUrl: "https://example.com/contact-header.png",
            },
            emailBox: {
              enabled: true,
              title: "",
              email: "legacy-contact-value",
              text: "Reach us through this mailbox.",
            },
            callBox: {
              enabled: true,
              title: "Call Center",
              phone: "",
              text: "Phone value can be empty on legacy rows.",
            },
            addressBox: {
              enabled: true,
              title: "Visit Us",
              address: "Smoke Address Lane 123",
            },
            middleLeftColumn: {
              enabled: true,
              imageDataUrl: "",
            },
            contactForm: {
              enabled: true,
              title: "",
              description: "Send us a short note and we will respond soon.",
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin contact us update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin contact us update should succeed");
  logPass("admin contact us update");

  logStep("reload admin contact us");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin contact us reload");
  const adminContact = reloadedAdmin.body?.data?.customization?.contactUs;
  assert.equal(Boolean(adminContact?.pageHeader?.enabled), true, "pageHeader should stay enabled");
  assert.equal(
    String(adminContact?.pageHeader?.pageTitle || ""),
    DEFAULT_CONTACT_PAGE_TITLE,
    "blank contact page title should normalize to backend default"
  );
  assert.equal(
    String(adminContact?.emailBox?.title || ""),
    DEFAULT_EMAIL_BOX_TITLE,
    "blank email box title should normalize to backend default"
  );
  assert.equal(
    String(adminContact?.emailBox?.email || ""),
    "legacy-contact-value",
    "legacy email-like value should persist as-is in backend payload"
  );
  assert.equal(
    String(adminContact?.contactForm?.description || ""),
    "Send us a short note and we will respond soon.",
    "contact form description should persist"
  );
  logPass("admin contact us persistence");

  logStep("verify public contact us serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=contact-us`
  );
  assert.equal(publicResponse.ok, true, "public contact us request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public contact us should return success=true");
  const publicContact = publicBody?.data?.customization?.contactUs;
  assert.equal(
    String(publicContact?.pageHeader?.pageTitle || ""),
    DEFAULT_CONTACT_PAGE_TITLE,
    "public payload should expose normalized contact page title"
  );
  assert.equal(
    String(publicContact?.emailBox?.email || ""),
    "legacy-contact-value",
    "public payload should preserve legacy email-like value safely"
  );
  assert.equal(
    String(publicContact?.callBox?.phone || ""),
    "029-00124667",
    "blank call phone should normalize to backend default"
  );
  assert.equal(
    String(publicContact?.middleLeftColumn?.imageDataUrl || ""),
    "",
    "public payload should expose empty middle left image safely"
  );
  assert.equal(
    String(publicContact?.contactForm?.description || ""),
    "Send us a short note and we will respond soon.",
    "public payload should expose contact form description"
  );
  logPass("public contact us serialization");

  logStep("verify disabled blocks");
  const disableResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          contactUs: {
            pageHeader: { enabled: false },
            emailBox: { enabled: false },
            callBox: { enabled: false },
            addressBox: { enabled: false },
            middleLeftColumn: { enabled: false },
            contactForm: { enabled: false },
          },
        },
      }),
    }
  );
  assertStatus(disableResponse, 200, "admin contact us disable");

  const disabledPublicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=contactUs`
  );
  assert.equal(disabledPublicResponse.ok, true, "public disabled contact request should succeed");
  const disabledPublicBody = await disabledPublicResponse.json();
  const disabledContact = disabledPublicBody?.data?.customization?.contactUs;
  assert.equal(Boolean(disabledContact?.pageHeader?.enabled), false, "pageHeader should serialize disabled");
  assert.equal(Boolean(disabledContact?.emailBox?.enabled), false, "emailBox should serialize disabled");
  assert.equal(Boolean(disabledContact?.callBox?.enabled), false, "callBox should serialize disabled");
  assert.equal(Boolean(disabledContact?.addressBox?.enabled), false, "addressBox should serialize disabled");
  assert.equal(
    Boolean(disabledContact?.middleLeftColumn?.enabled),
    false,
    "middleLeftColumn should serialize disabled"
  );
  assert.equal(
    Boolean(disabledContact?.contactForm?.enabled),
    false,
    "contactForm should serialize disabled"
  );
  logPass("disabled serialization");

  console.log("[mvf-contact] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-contact] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-contact] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
