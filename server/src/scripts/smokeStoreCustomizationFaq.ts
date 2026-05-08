import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `faq${String(Date.now()).slice(-8)}`;
const DEFAULT_FAQ_PAGE_TITLE = "FAQs";
const DEFAULT_FAQ_TITLE_TWO = "Can I cancel my subscription anytime?";
const DEFAULT_FAQ_DESCRIPTION_THREE =
  "We currently support the configured payment methods available in your region and account setup.";

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
  console.log(`[mvf-faq] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-faq] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-faq] API not ready at ${BASE_URL}/api/health`);
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

  logStep("persist faq customization");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          faqs: {
            pageHeader: {
              enabled: true,
              pageTitle: "",
              backgroundImageDataUrl: "https://example.com/faq-header.png",
            },
            leftColumn: {
              enabled: true,
              leftImageDataUrl: "",
            },
            content: {
              enabled: true,
              items: [
                {
                  title: "Smoke FAQ One",
                  description: "Smoke FAQ Description One",
                },
                {
                  title: "",
                  description: "Only description on item two",
                },
                {
                  title: "Title only item three",
                  description: "",
                },
              ],
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin faq update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin faq update should succeed");
  logPass("admin faq update");

  logStep("reload admin faq");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin faq reload");
  const adminFaqs = reloadedAdmin.body?.data?.customization?.faqs;
  assert.equal(Boolean(adminFaqs?.pageHeader?.enabled), true, "admin reload should keep pageHeader enabled");
  assert.equal(
    String(adminFaqs?.pageHeader?.pageTitle || ""),
    DEFAULT_FAQ_PAGE_TITLE,
    "blank faq page title should normalize to backend default"
  );
  assert.equal(
    String(adminFaqs?.content?.items?.[0]?.title || ""),
    "Smoke FAQ One",
    "configured faq item should persist"
  );
  assert.equal(
    String(adminFaqs?.content?.items?.[1]?.description || ""),
    "Only description on item two",
    "partial faq description should persist"
  );
  logPass("admin faq persistence");

  logStep("verify public faq serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=faq`
  );
  assert.equal(publicResponse.ok, true, "public faq request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public faq should return success=true");
  const publicFaqs = publicBody?.data?.customization?.faqs;
  assert.equal(Boolean(publicFaqs?.pageHeader?.enabled), true, "public payload should expose pageHeader enabled");
  assert.equal(
    String(publicFaqs?.pageHeader?.pageTitle || ""),
    DEFAULT_FAQ_PAGE_TITLE,
    "public payload should expose normalized faq page title"
  );
  assert.equal(
    String(publicFaqs?.leftColumn?.leftImageDataUrl || ""),
    "",
    "public payload should expose empty left image safely"
  );
  assert.equal(
    String(publicFaqs?.content?.items?.[1]?.title || ""),
    DEFAULT_FAQ_TITLE_TWO,
    "public payload should expose backend fallback title for partial item"
  );
  assert.equal(
    String(publicFaqs?.content?.items?.[2]?.description || ""),
    DEFAULT_FAQ_DESCRIPTION_THREE,
    "public payload should expose backend fallback description for partial item"
  );
  logPass("public faq serialization");

  logStep("verify disabled blocks");
  const disableResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          faqs: {
            pageHeader: { enabled: false },
            leftColumn: { enabled: false },
            content: { enabled: false },
          },
        },
      }),
    }
  );
  assertStatus(disableResponse, 200, "admin faq disable");
  const disabledPublicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=faq`
  );
  assert.equal(disabledPublicResponse.ok, true, "public disabled faq request should succeed");
  const disabledPublicBody = await disabledPublicResponse.json();
  const disabledFaqs = disabledPublicBody?.data?.customization?.faqs;
  assert.equal(Boolean(disabledFaqs?.pageHeader?.enabled), false, "pageHeader should serialize disabled");
  assert.equal(Boolean(disabledFaqs?.leftColumn?.enabled), false, "leftColumn should serialize disabled");
  assert.equal(Boolean(disabledFaqs?.content?.enabled), false, "content should serialize disabled");
  logPass("faq disabled serialization");

  console.log("[mvf-faq] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-faq] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-faq] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
