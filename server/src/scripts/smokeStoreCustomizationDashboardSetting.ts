import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `dashset${String(Date.now()).slice(-8)}`;

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
  console.log(`[mvf-dashboard] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-dashboard] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-dashboard] API not ready at ${BASE_URL}/api/health`);
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

  logStep("persist dashboard setting customization");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          dashboardSetting: {
            dashboard: {
              sectionTitle: "Account Dashboard",
              invoiceMessageFirstPartValue: "Thank you for shopping with us",
              invoiceMessageLastPartValue: "Keep this invoice reference for tracking and support.",
              printButtonValue: "Print Receipt",
              downloadButtonValue: "Download Receipt",
              dashboardLabel: "Account Home",
              totalOrdersLabel: "All Orders",
              pendingOrderValue: "Awaiting Payment",
              processingOrderValue: "Being Packed",
              completeOrderValue: "Delivered Orders",
              recentOrderValue: "Recent Purchases",
              myOrderValue: "Order History",
            },
            updateProfile: {
              sectionTitleValue: "Edit Profile",
              fullNameLabel: "Display Name",
              addressLabel: "Primary Address",
              phoneMobileLabel: "Mobile Number",
              emailAddressLabel: "Email Login",
              updateButtonValue: "Save Profile",
              currentPasswordLabel: "Current Secret",
              newPasswordLabel: "New Secret",
              changePasswordLabel: "Update Password",
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin dashboard-setting update");
  assert.equal(Boolean(updateResponse.body?.success), true, "dashboard-setting update should succeed");
  logPass("admin dashboard-setting update");

  logStep("reload admin dashboard setting");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin dashboard-setting reload");
  const adminDashboardSetting = reloadedAdmin.body?.data?.customization?.dashboardSetting;
  assert.equal(
    String(adminDashboardSetting?.dashboard?.sectionTitle || ""),
    "Account Dashboard",
    "dashboard section title should persist"
  );
  assert.equal(
    String(adminDashboardSetting?.dashboard?.printButtonValue || ""),
    "Print Receipt",
    "print button text should persist"
  );
  assert.equal(
    String(adminDashboardSetting?.dashboard?.myOrderValue || ""),
    "Order History",
    "my orders value should persist"
  );
  assert.equal(
    String(adminDashboardSetting?.updateProfile?.sectionTitleValue || ""),
    "Edit Profile",
    "update profile title should persist"
  );
  assert.equal(
    String(adminDashboardSetting?.updateProfile?.phoneMobileLabel || ""),
    "Mobile Number",
    "phone/mobile label should persist"
  );
  assert.equal(
    String(adminDashboardSetting?.updateProfile?.changePasswordLabel || ""),
    "Update Password",
    "change password label should persist"
  );
  logPass("admin dashboard-setting reload");

  logStep("verify public dashboard setting serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(
      SMOKE_LANG
    )}&include=dashboardSetting`
  );
  assert.equal(publicResponse.ok, true, "public dashboard-setting request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public dashboard-setting should return success=true");
  const publicDashboardSetting = publicBody?.data?.customization?.dashboardSetting;
  assert.equal(
    String(publicDashboardSetting?.dashboard?.invoiceMessageFirstPartValue || ""),
    "Thank you for shopping with us",
    "public dashboard-setting should expose invoice message first part"
  );
  assert.equal(
    String(publicDashboardSetting?.dashboard?.downloadButtonValue || ""),
    "Download Receipt",
    "public dashboard-setting should expose download button text"
  );
  assert.equal(
    String(publicDashboardSetting?.dashboard?.recentOrderValue || ""),
    "Recent Purchases",
    "public dashboard-setting should expose recent order title"
  );
  assert.equal(
    String(publicDashboardSetting?.updateProfile?.fullNameLabel || ""),
    "Display Name",
    "public dashboard-setting should expose full name label"
  );
  assert.equal(
    String(publicDashboardSetting?.updateProfile?.emailAddressLabel || ""),
    "Email Login",
    "public dashboard-setting should expose email label"
  );
  assert.equal(
    String(publicDashboardSetting?.updateProfile?.newPasswordLabel || ""),
    "New Secret",
    "public dashboard-setting should expose new password label"
  );
  logPass("public dashboard-setting serialization");

  console.log("[mvf-dashboard] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-dashboard] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-dashboard] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
