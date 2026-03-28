import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { Store, StoreApplication, User, sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-store-app-${Date.now()}`;

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
};

type FixtureUser = {
  id: number;
  email: string;
  password: string;
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

const createdUserIds: number[] = [];
const createdStoreIds: number[] = [];
const createdApplicationIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-store-application] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-store-application] PASS ${label}`);
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
    `[mvf-store-application] API not ready at ${BASE_URL}/api/health`
  );
}

async function createFixtureUser(label: string): Promise<FixtureUser> {
  const email = `${RUN_ID}-${label}@local.dev`;
  const password = DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: `MVF ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password };
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
  assert.equal(Boolean(response.body?.success), true, `${label}: login should succeed`);
}

async function cleanupFixtures() {
  if (createdApplicationIds.length > 0) {
    await StoreApplication.destroy({
      where: { id: { [Op.in]: createdApplicationIds } } as any,
      force: true,
    }).catch(() => null);
  }

  if (createdStoreIds.length > 0) {
    await Store.destroy({
      where: { id: { [Op.in]: createdStoreIds } } as any,
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

  const applicant = await createFixtureUser("applicant");
  const outsider = await createFixtureUser("outsider");

  const applicantClient = new CookieClient();
  const outsiderClient = new CookieClient();

  await login(applicantClient, applicant.email, applicant.password, "applicant login");
  await login(outsiderClient, outsider.email, outsider.password, "outsider login");

  logStep("creating draft application");
  const createDraftResponse = await applicantClient.request("/api/user/store-applications/draft", {
    method: "POST",
    body: JSON.stringify({
      currentStep: "store_information",
      storeInformationSnapshot: {
        storeName: `${RUN_ID} Store`,
      },
    }),
  });
  assertStatus(createDraftResponse, 201, "create draft");
  const applicationId = Number(createDraftResponse.body?.data?.id || 0);
  assert.ok(applicationId > 0, "create draft: application id missing");
  createdApplicationIds.push(applicationId);
  assert.equal(
    String(createDraftResponse.body?.data?.status || ""),
    "draft",
    "create draft: status should be draft"
  );
  logPass("create draft");

  logStep("loading current application");
  const currentResponse = await applicantClient.request("/api/user/store-applications/current");
  assertStatus(currentResponse, 200, "get current application");
  assert.equal(
    Number(currentResponse.body?.data?.id || 0),
    applicationId,
    "get current application: wrong application id"
  );
  logPass("get current application");

  logStep("updating draft application");
  const updateDraftResponse = await applicantClient.request(
    `/api/user/store-applications/${applicationId}/draft`,
    {
      method: "PATCH",
      body: JSON.stringify({
        currentStep: "compliance",
        ownerIdentitySnapshot: {
          fullName: "MVF Applicant",
          email: applicant.email,
          phoneNumber: "+628111111111",
        },
        storeInformationSnapshot: {
          storeName: `${RUN_ID} Store`,
          storeSlug: `${RUN_ID}-store`,
          storeCategory: "groceries",
          description: "Seller onboarding smoke description.",
        },
        operationalAddressSnapshot: {
          addressLine1: "Jl. Smoke Test 1",
          city: "Jakarta",
          province: "DKI Jakarta",
          country: "Indonesia",
        },
        payoutPaymentSnapshot: {
          payoutMethod: "bank_transfer",
          accountHolderName: "MVF Applicant",
        },
        complianceSnapshot: {
          supportEmail: applicant.email,
          agreedToTerms: true,
        },
      }),
    }
  );
  assertStatus(updateDraftResponse, 200, "update draft");
  assert.equal(
    Boolean(updateDraftResponse.body?.data?.completeness?.isComplete),
    true,
    "update draft: completeness should be true"
  );
  logPass("update draft");

  logStep("submitting application");
  const submitResponse = await applicantClient.request(
    `/api/user/store-applications/${applicationId}/submit`,
    {
      method: "POST",
    }
  );
  assertStatus(submitResponse, 200, "submit application");
  assert.equal(
    String(submitResponse.body?.data?.status || ""),
    "submitted",
    "submit application: status should be submitted"
  );
  logPass("submit application");

  logStep("verifying forbidden access by outsider");
  const forbiddenReadResponse = await outsiderClient.request(
    `/api/user/store-applications/${applicationId}`
  );
  assertStatus(forbiddenReadResponse, 404, "outsider read application");
  logPass("forbidden access");

  logStep("simulating revision request");
  await StoreApplication.update(
    {
      status: "revision_requested",
      reviewedAt: new Date(),
      revisionNote: "Please clarify the payout method details.",
    } as any,
    {
      where: { id: applicationId } as any,
    }
  );

  const revisedStateResponse = await applicantClient.request(
    `/api/user/store-applications/${applicationId}`
  );
  assertStatus(revisedStateResponse, 200, "get revision-requested application");
  assert.equal(
    String(revisedStateResponse.body?.data?.status || ""),
    "revision_requested",
    "revision-requested application: status mismatch"
  );

  logStep("updating revision draft and resubmitting");
  const reviseDraftResponse = await applicantClient.request(
    `/api/user/store-applications/${applicationId}/draft`,
    {
      method: "PATCH",
      body: JSON.stringify({
        currentStep: "payout_payment",
        payoutPaymentSnapshot: {
          payoutMethod: "bank_transfer",
          accountHolderName: "MVF Applicant",
          accountNumber: "1234567890",
          bankName: "Bank Smoke",
        },
      }),
    }
  );
  assertStatus(reviseDraftResponse, 200, "update revision draft");

  const resubmitResponse = await applicantClient.request(
    `/api/user/store-applications/${applicationId}/resubmit`,
    {
      method: "POST",
    }
  );
  assertStatus(resubmitResponse, 200, "resubmit application");
  assert.equal(
    String(resubmitResponse.body?.data?.status || ""),
    "submitted",
    "resubmit application: status should return to submitted"
  );
  assert.equal(
    resubmitResponse.body?.data?.revisionNote ?? null,
    null,
    "resubmit application: revision note should be cleared"
  );
  logPass("resubmit after revision");

  console.log("[mvf-store-application] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-store-application] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-store-application] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
