import "dotenv/config";
import assert from "node:assert/strict";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const SMOKE_LANG = `checkout${String(Date.now()).slice(-8)}`;

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
  console.log(`[mvf-checkout] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-checkout] PASS ${label}`);
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
  assert.equal(response.ok, true, `[mvf-checkout] API not ready at ${BASE_URL}/api/health`);
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

  logStep("persist checkout customization with mixed legacy and current fields");
  const updateResponse = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`,
    {
      method: "PUT",
      body: JSON.stringify({
        customization: {
          checkout: {
            personalDetails: {
              sectionTitle: "Contact Details",
              sectionHint: "Use an email and phone number that can receive delivery updates.",
              firstNameLabel: "Given Name",
              firstNamePlaceholder: "Given Name",
            },
            shippingDetails: {
              sectionTitle: "Delivery Details",
              sectionHint: "Confirm the destination used for the current delivery run.",
              countryLabel: "Province Legacy",
              cityLabel: "City/Regency Custom",
              districtLabel: "District Custom",
              zipLabel: "Postal Legacy",
              streetAddressLabel: "Street Legacy",
              streetAddressPlaceholder: "Street Placeholder Legacy",
              defaultShippingToggleLabel: "Use Saved Address",
              defaultShippingToggleEnabledLabel: "Use Saved",
              defaultShippingToggleDisabledLabel: "Manual",
              defaultShippingLoadingLabel: "Loading saved address...",
              paymentMethodPlaceholder: "Select QRIS store payment",
            },
            buttons: {
              continueButtonLabel: "Continue Shipping",
              confirmButtonLabel: "Confirm Order",
              processingButtonLabel: "Submitting order...",
            },
            cartItemSection: {
              sectionTitle: "Cart Item Section",
              orderSummaryLabel: "Order Review",
              sectionDescription: "Review totals before sending this order.",
              estimatedTotalLabel: "Projected Total",
              itemCountSuffix: "Lines",
              applyButtonLabel: "Apply Coupon",
              applyingButtonLabel: "Applying Coupon...",
              couponCodeLabel: "Promo Code",
              couponCodePlaceholder: "Enter Promo",
              couponHelperText: "Use one coupon code for the eligible order scope.",
              itemPriceLabel: "Row Price",
              subTotalLabel: "Sub Total",
              shippingLabel: "Delivery Fee",
              discountLabel: "Promo Discount",
              taxLabel: "VAT",
              totalCostLabel: "Total Cost",
              postSubmitNotice: "A payment page will open after the order reference is created.",
              confirmationHelperText: "Placing this order confirms the delivery details above.",
              summaryReadyHint: "Live totals are already reflected in this summary.",
              submitNextLabel: "Ready",
              previewFirstLabel: "Previewing",
            },
          },
        },
      }),
    }
  );
  assertStatus(updateResponse, 200, "admin checkout update");
  assert.equal(Boolean(updateResponse.body?.success), true, "admin checkout update should succeed");
  logPass("admin checkout update");

  logStep("reload admin checkout customization");
  const reloadedAdmin = await adminClient.request(
    `/api/admin/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}`
  );
  assertStatus(reloadedAdmin, 200, "admin checkout reload");
  const adminCheckout = reloadedAdmin.body?.data?.customization?.checkout;
  assert.equal(
    String(adminCheckout?.personalDetails?.sectionHint || ""),
    "Use an email and phone number that can receive delivery updates.",
    "personal details helper text should persist"
  );
  assert.equal(
    String(adminCheckout?.shippingDetails?.provinceLabel || ""),
    "Province Legacy",
    "legacy countryLabel should normalize to provinceLabel"
  );
  assert.equal(
    String(adminCheckout?.shippingDetails?.postalCodeLabel || ""),
    "Postal Legacy",
    "legacy zipLabel should normalize to postalCodeLabel"
  );
  assert.equal(
    String(adminCheckout?.shippingDetails?.streetNameLabel || ""),
    "Street Legacy",
    "legacy streetAddressLabel should normalize to streetNameLabel"
  );
  assert.equal(
    String(adminCheckout?.buttons?.continueButtonLabel || ""),
    "Back to Cart",
    "legacy continue button label should normalize to client checkout CTA"
  );
  assert.equal(
    String(adminCheckout?.buttons?.confirmButtonLabel || ""),
    "Place an Order",
    "legacy confirm button label should normalize to client checkout CTA"
  );
  assert.equal(
    String(adminCheckout?.cartItemSection?.sectionTitle || ""),
    "Checkout Summary",
    "legacy cart item section title should normalize to checkout summary"
  );
  assert.equal(
    String(adminCheckout?.cartItemSection?.subTotalLabel || ""),
    "Subtotal",
    "legacy subtotal label should normalize to subtotal"
  );
  assert.equal(
    String(adminCheckout?.cartItemSection?.totalCostLabel || ""),
    "TOTAL COST",
    "legacy total cost label should normalize to total cost display"
  );
  logPass("admin checkout normalization");

  logStep("verify public checkout serialization");
  const publicResponse = await fetch(
    `${BASE_URL}/api/store/customization?lang=${encodeURIComponent(SMOKE_LANG)}&include=checkout`
  );
  assert.equal(publicResponse.ok, true, "public checkout request should succeed");
  const publicBody = await publicResponse.json();
  assert.equal(Boolean(publicBody?.success), true, "public checkout should return success=true");
  const publicCheckout = publicBody?.data?.customization?.checkout;
  assert.equal(
    String(publicCheckout?.shippingDetails?.provinceLabel || ""),
    "Province Legacy",
    "public checkout should expose provinceLabel"
  );
  assert.equal(
    String(publicCheckout?.shippingDetails?.postalCodeLabel || ""),
    "Postal Legacy",
    "public checkout should expose postalCodeLabel"
  );
  assert.equal(
    String(publicCheckout?.shippingDetails?.streetNamePlaceholder || ""),
    "Street Placeholder Legacy",
    "public checkout should expose legacy street placeholder via streetNamePlaceholder"
  );
  assert.equal(
    String(publicCheckout?.shippingDetails?.defaultShippingToggleLabel || ""),
    "Use Saved Address",
    "public checkout should expose current toggle label"
  );
  assert.equal(
    String(publicCheckout?.buttons?.processingButtonLabel || ""),
    "Submitting order...",
    "public checkout should expose processing button label"
  );
  assert.equal(
    String(publicCheckout?.cartItemSection?.couponCodeLabel || ""),
    "Promo Code",
    "public checkout should expose coupon code label"
  );
  assert.equal(
    String(publicCheckout?.cartItemSection?.postSubmitNotice || ""),
    "A payment page will open after the order reference is created.",
    "public checkout should expose post-submit notice"
  );
  logPass("public checkout serialization");

  console.log("[mvf-checkout] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-checkout] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup().catch((error) => {
      console.error("[mvf-checkout] cleanup failed", error);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
