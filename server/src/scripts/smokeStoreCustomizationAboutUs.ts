import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `abus${String(Date.now()).slice(-8)}`;
const DEFAULT_PAGE_TITLE = "About Us";
const DEFAULT_SECOND_PARAGRAPH =
  "We continue improving operations, product quality, and customer support to provide a dependable shopping experience.";

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
  console.log(`[mvf-about-us] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-about-us] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-about-us] API not ready at ${BASE_URL}/api/health`);
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

  logStep("load admin about us defaults");
  const initialAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(initialAdmin, 200, "admin customization load");
  assert.equal(Boolean(initialAdmin.body?.success), true, "admin customization load should succeed");
  assert.equal(
    typeof initialAdmin.body?.data?.customization?.aboutUs,
    "object",
    "initial aboutUs should exist in admin payload"
  );
  logPass("admin about us default load");

  logStep("persist about us customization");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          aboutUs: {
            pageHeader: {
              enabled: true,
              pageTitle: "",
              backgroundImageDataUrl: "https://example.com/about-header.png",
            },
            topContentLeft: {
              enabled: true,
              topTitle: "Smoke About Title",
              topDescription: "Smoke About Description",
              boxOne: {
                title: "11K",
                subtitle: "Smoke Listed Products",
                description: "Smoke box one",
              },
              boxTwo: {
                title: "9K",
                subtitle: "",
                description: "Smoke box two",
              },
              boxThree: {
                title: "",
                subtitle: "Smoke box three subtitle",
                description: "",
              },
            },
            topContentRight: {
              enabled: true,
              imageDataUrl: "",
            },
            contentSection: {
              enabled: true,
              firstParagraph: "Smoke first paragraph",
              secondParagraph: "",
              contentImageDataUrl: "",
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin about us update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin about us update should succeed");
  logPass("admin about us update");

  logStep("reload admin about us and verify persistence");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin about us reload");
  const reloadedAboutUs = reloadedAdmin.body?.data?.customization?.aboutUs;
  assert.equal(Boolean(reloadedAboutUs?.pageHeader?.enabled), true, "pageHeader should stay enabled");
  assert.equal(
    String(reloadedAboutUs?.pageHeader?.pageTitle || ""),
    DEFAULT_PAGE_TITLE,
    "blank page title should normalize to existing backend default"
  );
  assert.equal(
    String(reloadedAboutUs?.pageHeader?.backgroundImageDataUrl || ""),
    "https://example.com/about-header.png",
    "page header image should persist"
  );
  assert.equal(
    String(reloadedAboutUs?.topContentLeft?.boxTwo?.description || ""),
    "Smoke box two",
    "top content left partial box content should persist"
  );
  assert.equal(
    String(reloadedAboutUs?.contentSection?.firstParagraph || ""),
    "Smoke first paragraph",
    "content section first paragraph should persist"
  );
  logPass("admin about us persistence");

  logStep("verify public about us serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=about-us`
  );
  assert.equal(publicResponse.ok, true, "public about us request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public about us should return success=true");
  const publicAboutUs = publicBody?.data?.customization?.aboutUs;
  assert.equal(Boolean(publicAboutUs?.pageHeader?.enabled), true, "public payload should expose pageHeader enabled");
  assert.equal(
    String(publicAboutUs?.pageHeader?.pageTitle || ""),
    DEFAULT_PAGE_TITLE,
    "public payload should expose normalized page title"
  );
  assert.equal(
    String(publicAboutUs?.topContentLeft?.topTitle || ""),
    "Smoke About Title",
    "public payload should expose top content left title"
  );
  assert.equal(
    String(publicAboutUs?.topContentRight?.imageDataUrl || ""),
    "",
    "public payload should expose empty top content right image safely"
  );
  assert.equal(
    String(publicAboutUs?.contentSection?.secondParagraph || ""),
    DEFAULT_SECOND_PARAGRAPH,
    "public payload should expose normalized second paragraph fallback safely"
  );
  logPass("public about us serialization");

  logStep("verify disabled blocks remain serializable");
  const disableResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          aboutUs: {
            topContentRight: {
              enabled: false,
            },
            contentSection: {
              enabled: false,
            },
          },
        },
      }),
    }
  );
  assertStatus(disableResponse, 200, "admin about us disable");
  const disabledPublicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=about-us`
  );
  assert.equal(disabledPublicResponse.ok, true, "disabled public about us request should succeed");
  const disabledPublicBody = await disabledPublicResponse.json();
  const disabledAboutUs = disabledPublicBody?.data?.customization?.aboutUs;
  assert.equal(Boolean(disabledAboutUs?.topContentRight?.enabled), false, "topContentRight should serialize disabled");
  assert.equal(Boolean(disabledAboutUs?.contentSection?.enabled), false, "contentSection should serialize disabled");
  logPass("about us disabled serialization");

  console.log("[mvf-about-us] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-about-us] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-about-us] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
