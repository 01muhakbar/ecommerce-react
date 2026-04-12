import "dotenv/config";
import assert from "node:assert/strict";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const RUN_ID = `mvf-currency-delete-${Date.now()}`;

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
  console.log(`[mvf-currency-delete] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-currency-delete] PASS ${label}`);
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
    `[mvf-currency-delete] API not ready at ${BASE_URL}/api/health`
  );
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function run() {
  await ensureServerReady();

  const adminClient = new CookieClient();
  await loginAdmin(adminClient);

  logStep("create disposable currency");
  const createResponse = await adminClient.request("/api/admin/currencies", {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID} Currency`,
      code: `Z${String(Date.now()).slice(-5)}`,
      symbol: "Z$",
      exchangeRate: "1.234567",
      published: true,
    }),
  });
  assertStatus(createResponse, 201, "create currency");
  const createdId = Number(createResponse.body?.data?.id || 0);
  assert.ok(createdId > 0, "created currency id should be present");
  logPass("create disposable currency");

  logStep("delete disposable currency");
  const deleteResponse = await adminClient.request(`/api/admin/currencies/${createdId}`, {
    method: "DELETE",
  });
  assertStatus(deleteResponse, 204, "delete currency");
  logPass("delete disposable currency");

  logStep("verify deleted currency stays deleted after refetch");
  const listResponse = await adminClient.request("/api/admin/currencies", {
    method: "GET",
  });
  assertStatus(listResponse, 200, "list currencies after delete");
  const currencies = Array.isArray(listResponse.body?.data) ? listResponse.body.data : [];
  const deletedRow = currencies.find((entry: any) => Number(entry?.id || 0) === createdId);
  assert.equal(Boolean(deletedRow), false, "deleted currency should not reappear after refetch");
  logPass("verify deleted currency stays deleted after refetch");

  console.log("[mvf-currency-delete] OK");
}

run().catch((error) => {
  console.error("[mvf-currency-delete] FAIL", error);
  process.exitCode = 1;
});
