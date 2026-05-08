import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `oteam${String(Date.now()).slice(-8)}`;

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
  console.log(`[mvf-our-team] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-our-team] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-our-team] API not ready at ${BASE_URL}/api/health`);
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

  logStep("persist our team customization");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          aboutUs: {
            ourTeam: {
              enabled: true,
              title: "Meet the Smoke Team",
              description: "Partial team payload for smoke verification.",
              members: [
                {
                  imageDataUrl: "https://example.com/member-1.png",
                  title: "Alice Smoke",
                  subTitle: "Operations Lead",
                },
                {
                  imageDataUrl: "",
                  title: "",
                  subTitle: "Support Specialist",
                },
                {
                  imageDataUrl: "",
                  title: "Product Designer",
                  subTitle: "",
                },
              ],
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin our team update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin our team update should succeed");
  logPass("admin our team update");

  logStep("reload admin our team");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin our team reload");
  const adminOurTeam = reloadedAdmin.body?.data?.customization?.aboutUs?.ourTeam;
  assert.equal(Boolean(adminOurTeam?.enabled), true, "admin reload should keep enabled=true");
  assert.equal(String(adminOurTeam?.title || ""), "Meet the Smoke Team", "admin reload should keep title");
  assert.equal(
    String(adminOurTeam?.members?.[0]?.title || ""),
    "Alice Smoke",
    "admin reload should keep configured member title"
  );
  assert.equal(
    String(adminOurTeam?.members?.[1]?.subTitle || ""),
    "Support Specialist",
    "admin reload should keep partial subtitle"
  );
  logPass("admin our team persistence");

  logStep("verify public our team serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=about-us`
  );
  assert.equal(publicResponse.ok, true, "public our team request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public our team should return success=true");
  const publicOurTeam = publicBody?.data?.customization?.aboutUs?.ourTeam;
  assert.equal(Boolean(publicOurTeam?.enabled), true, "public payload should expose enabled=true");
  assert.equal(
    String(publicOurTeam?.members?.[0]?.imageDataUrl || ""),
    "https://example.com/member-1.png",
    "public payload should expose configured member image"
  );
  assert.equal(
    String(publicOurTeam?.members?.[1]?.title || ""),
    "Name 2",
    "public payload should expose backend fallback title for partial member"
  );
  assert.equal(
    String(publicOurTeam?.members?.[1]?.subTitle || ""),
    "Support Specialist",
    "public payload should keep configured partial subtitle"
  );
  assert.equal(
    String(publicOurTeam?.members?.[2]?.title || ""),
    "Product Designer",
    "public payload should keep configured partial title"
  );
  assert.equal(
    String(publicOurTeam?.members?.[2]?.subTitle || ""),
    "Role 3",
    "public payload should expose backend fallback subtitle for partial member"
  );
  assert.equal(
    Array.isArray(publicOurTeam?.members) ? publicOurTeam.members.length : 0,
    6,
    "public payload should keep fixed six-member shape"
  );
  logPass("public our team serialization");

  logStep("verify disabled state");
  const disableResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          aboutUs: {
            ourTeam: {
              enabled: false,
            },
          },
        },
      }),
    }
  );
  assertStatus(disableResponse, 200, "admin our team disable");
  const disabledPublicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=about-us`
  );
  assert.equal(disabledPublicResponse.ok, true, "public disabled our team request should succeed");
  const disabledPublicBody = await disabledPublicResponse.json();
  assert.equal(
    Boolean(disabledPublicBody?.data?.customization?.aboutUs?.ourTeam?.enabled),
    false,
    "public payload should expose enabled=false"
  );
  logPass("our team disabled serialization");

  console.log("[mvf-our-team] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-our-team] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-our-team] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
