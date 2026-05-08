import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import Stripe from "stripe";
import { Op, QueryTypes } from "sequelize";
import { Order, User, sequelize } from "../models/index.js";
import { ensureSettingsTable } from "../services/storeSettings.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf5-stripe-webhook-${Date.now()}`;
const STRIPE_WEBHOOK_SECRET = "whsec_teststripewebhook12345";

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
};

const createdUserIds: number[] = [];
const createdOrderIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-stripe-webhook] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-stripe-webhook] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
  const headers = new Headers(init.headers || {});
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });
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

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(
    response.ok,
    true,
    `[mvf-stripe-webhook] API not ready at ${BASE_URL}/api/health`
  );
}

async function backupStoreSettingsValue() {
  await ensureSettingsTable();
  const rows = await sequelize.query<{ value: string }>(
    "SELECT `value` FROM settings WHERE `key` = 'storeSettings' LIMIT 1",
    { type: QueryTypes.SELECT }
  );
  return rows[0]?.value || null;
}

async function restoreStoreSettingsValue(value: string | null) {
  await ensureSettingsTable();
  if (!value) {
    await sequelize.query("DELETE FROM settings WHERE `key` = 'storeSettings'");
    return;
  }

  await sequelize.query(
    `
      INSERT INTO settings (\`key\`, \`value\`, createdAt, updatedAt)
      VALUES ('storeSettings', :value, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        \`value\` = VALUES(\`value\`),
        updatedAt = VALUES(updatedAt)
    `,
    {
      replacements: { value },
    }
  );
}

async function createFixtureUser() {
  const email = `${RUN_ID}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: "MVF Stripe Webhook Buyer",
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email };
}

async function createStripeOrder(userId: number) {
  const invoiceNo = `STORE-${RUN_ID}`;
  const order = await Order.create({
    invoiceNo,
    userId,
    customerName: "MVF Stripe Webhook Buyer",
    customerPhone: "081234567890",
    customerAddress: "Jl. Webhook No. 1",
    paymentMethod: "STRIPE",
    paymentStatus: "UNPAID",
    totalAmount: 125000,
    status: "pending",
  } as any);
  const id = Number(order.getDataValue("id"));
  createdOrderIds.push(id);
  return { id, invoiceNo };
}

async function cleanupFixtures() {
  if (createdOrderIds.length > 0) {
    await Order.destroy({
      where: { id: { [Op.in]: createdOrderIds } } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdUserIds.length > 0) {
    await User.destroy({
      where: { id: { [Op.in]: createdUserIds } } as any,
      force: true,
    }).catch(() => null);
  }
}

async function run() {
  await ensureServerReady();
  await sequelize.authenticate();
  const settingsBackup = await backupStoreSettingsValue();

  try {
    logStep("persist stripe webhook-ready settings");
    const settingsValue = JSON.stringify({
      payments: {
        cashOnDeliveryEnabled: true,
        stripeEnabled: true,
        stripeKey: "pk_test_example12345",
        stripeSecret: "sk_test_example12345",
        stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
        razorPayEnabled: false,
        razorPayKeyId: "",
        razorPayKeySecret: "",
      },
    });
    await restoreStoreSettingsValue(settingsValue);
    logPass("stripe webhook settings persisted");

    logStep("create unpaid stripe order fixture");
    const user = await createFixtureUser();
    const order = await createStripeOrder(user.id);

    const eventPayload = JSON.stringify({
      id: `evt_${RUN_ID}`,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          object: "checkout.session",
          id: `cs_test_${RUN_ID}`,
          client_reference_id: order.invoiceNo,
          metadata: {
            orderId: String(order.id),
            invoiceNo: order.invoiceNo,
            paymentMethod: "STRIPE",
          },
          payment_status: "paid",
          status: "complete",
        },
      },
    });
    const signature = Stripe.webhooks.generateTestHeaderString({
      payload: eventPayload,
      secret: STRIPE_WEBHOOK_SECRET,
    });

    logStep("deliver signed stripe webhook");
    const firstWebhook = await request("/api/store/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: eventPayload,
    });
    assertStatus(firstWebhook, 200, "stripe webhook first delivery");
    assert.equal(
      Boolean(firstWebhook.body?.data?.updated),
      true,
      "stripe webhook first delivery: expected order update"
    );
    logPass("signed stripe webhook accepted");

    const paidOrder = await Order.findByPk(order.id, {
      attributes: ["paymentStatus", "status"],
    });
    assert.equal(
      String(paidOrder?.getDataValue("paymentStatus") || ""),
      "PAID",
      "order payment status should be PAID after webhook"
    );
    assert.equal(
      String(paidOrder?.getDataValue("status") || ""),
      "processing",
      "order status should move to processing after webhook"
    );
    logPass("webhook finalizes unpaid stripe order");

    logStep("deliver duplicate signed stripe webhook");
    const duplicateWebhook = await request("/api/store/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
      },
      body: eventPayload,
    });
    assertStatus(duplicateWebhook, 200, "stripe webhook duplicate delivery");
    assert.equal(
      Boolean(duplicateWebhook.body?.data?.updated),
      false,
      "duplicate webhook should not update the order again"
    );
    assert.equal(
      Boolean(duplicateWebhook.body?.data?.alreadyFinalized),
      true,
      "duplicate webhook should report alreadyFinalized"
    );
    logPass("duplicate webhook stays idempotent");

    logStep("reject invalid stripe webhook signature");
    const invalidSignatureWebhook = await request("/api/store/stripe/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "t=1,v1=invalid",
      },
      body: eventPayload,
    });
    assertStatus(invalidSignatureWebhook, 400, "stripe webhook invalid signature");
    assert.equal(
      String(invalidSignatureWebhook.body?.code || ""),
      "STRIPE_WEBHOOK_SIGNATURE_INVALID",
      "invalid webhook signature should be rejected"
    );
    logPass("invalid webhook signature rejected");

    console.log("[mvf-stripe-webhook] OK");
  } finally {
    await restoreStoreSettingsValue(settingsBackup);
  }
}

run()
  .catch((error) => {
    console.error("[mvf-stripe-webhook] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanupFixtures();
    } catch (cleanupError) {
      console.error("[mvf-stripe-webhook] cleanup failed", cleanupError);
      process.exitCode = 1;
    }
    try {
      await sequelize.close();
    } catch {
      // ignore close failures in smoke cleanup
    }
  });
