import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { StoreApplication, User, sequelize } from "../models/index.js";
import { buildStoreApplicationMutationMetadata } from "../services/storeApplication.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-admin-store-app-${Date.now()}`;

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

type FixtureUser = {
  id: number;
  email: string;
  password: string;
};

const createdUserIds: number[] = [];
const createdApplicationIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-admin-store-application] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-admin-store-application] PASS ${label}`);
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
    `[mvf-admin-store-application] API not ready at ${BASE_URL}/api/health`
  );
}

async function createFixtureUser(label: string, role: string): Promise<FixtureUser> {
  const email = `${RUN_ID}-${label}@local.dev`;
  const password = DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: `MVF ${label}`,
    email,
    password: hashed,
    role,
    status: "active",
    phoneNumber: `+6281${Math.floor(Math.random() * 1_000_000_000)
      .toString()
      .padStart(9, "0")}`,
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
}

async function createSubmittedApplication(applicantUserId: number, label: string) {
  const application = await StoreApplication.create({
    applicantUserId,
    status: "submitted",
    currentStep: "review",
    ownerIdentitySnapshot: {
      fullName: `Applicant ${label}`,
      operationalContactName: `PIC ${label}`,
      email: `${RUN_ID}-${label}@seller.local`,
      phoneNumber: `+62811${label.length}000000`,
      birthDate: "1990-01-01",
      identityType: "KTP",
      identityLegalName: `Applicant ${label}`,
    },
    storeInformationSnapshot: {
      storeName: `Store ${label}`,
      storeSlug: `${RUN_ID}-${label}`,
      storeCategory: "fashion",
      description: `Store description ${label}`,
      sellerType: "UMKM",
      isSelfProduced: true,
      initialProductCount: 12,
    },
    operationalAddressSnapshot: {
      contactName: `Ops ${label}`,
      phoneNumber: `+62812${label.length}111111`,
      addressLine1: `Jl. ${label} No. 1`,
      city: "Jakarta",
      province: "DKI Jakarta",
      district: "Setiabudi",
      postalCode: "12910",
      country: "Indonesia",
      notes: `Address note ${label}`,
    },
    payoutPaymentSnapshot: {
      payoutMethod: "bank_transfer",
      accountHolderName: `Applicant ${label}`,
      accountNumber: "1234567890123",
      bankName: "Bank Smoke",
      accountHolderMatchesIdentity: true,
    },
    complianceSnapshot: {
      supportEmail: `${RUN_ID}-${label}@support.local`,
      supportPhone: `+62813${label.length}222222`,
      taxId: "12.345.678.9-000.000",
      identityNumber: `3174${label.length}000001`,
      productTypes: "fashion muslim",
      brandOwnershipType: "OWN_BRAND",
      authenticityConfirmed: true,
      prohibitedGoodsConfirmed: true,
      websiteUrl: "https://example.test",
      socialMediaUrl: "https://instagram.com/example",
      notes: `Compliance note ${label}`,
      agreedToTerms: true,
      agreedToAdminReview: true,
      agreedToPlatformPolicy: true,
      understandsStoreInactiveUntilApproved: true,
    },
    submittedAt: new Date(),
    internalMetadata: buildStoreApplicationMutationMetadata(null, {
      createdFrom: "admin_smoke",
      submittedCount: 1,
      lastSubmittedAt: new Date().toISOString(),
    }),
  } as any);

  const id = Number(application.getDataValue("id"));
  createdApplicationIds.push(id);
  return id;
}

async function cleanupFixtures() {
  if (createdApplicationIds.length > 0) {
    await StoreApplication.destroy({
      where: { id: { [Op.in]: createdApplicationIds } } as any,
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

  const admin = await createFixtureUser("admin", "admin");
  const outsider = await createFixtureUser("outsider", "customer");
  const applicantRevision = await createFixtureUser("revision", "customer");
  const applicantReject = await createFixtureUser("reject", "customer");
  const applicantApprove = await createFixtureUser("approve", "customer");

  const revisionApplicationId = await createSubmittedApplication(applicantRevision.id, "revision");
  const rejectApplicationId = await createSubmittedApplication(applicantReject.id, "reject");
  const approveApplicationId = await createSubmittedApplication(applicantApprove.id, "approve");

  const adminClient = new CookieClient();
  const outsiderClient = new CookieClient();

  await login(adminClient, admin.email, admin.password, "admin login");
  await login(outsiderClient, outsider.email, outsider.password, "outsider login");

  logStep("admin list applications");
  const listResponse = await adminClient.request("/api/admin/store-applications?status=submitted");
  assertStatus(listResponse, 200, "admin list applications");
  const listItems = Array.isArray(listResponse.body?.data) ? listResponse.body.data : [];
  assert.ok(
    listItems.some((item: any) => Number(item.id) === revisionApplicationId),
    "admin list applications: expected submitted application in response"
  );
  logPass("admin list applications");

  logStep("admin detail application");
  const detailResponse = await adminClient.request(
    `/api/admin/store-applications/${revisionApplicationId}`
  );
  assertStatus(detailResponse, 200, "admin detail application");
  assert.equal(
    String(detailResponse.body?.data?.storeInformation?.storeName || ""),
    "Store revision",
    "admin detail application: store name mismatch"
  );
  logPass("admin detail application");

  logStep("forbidden non-admin access");
  const forbiddenResponse = await outsiderClient.request("/api/admin/store-applications");
  assertStatus(forbiddenResponse, 403, "forbidden non-admin list");
  logPass("forbidden non-admin access");

  logStep("request revision");
  const revisionResponse = await adminClient.request(
    `/api/admin/store-applications/${revisionApplicationId}/revision-request`,
    {
      method: "PATCH",
      body: JSON.stringify({
        revisionNote: "Please clarify the operational address and contact details.",
        revisionSummary: "Address block and operational phone need revision.",
        internalAdminNote: "Flagged for address mismatch review.",
      }),
    }
  );
  assertStatus(revisionResponse, 200, "request revision");
  assert.equal(
    String(revisionResponse.body?.data?.status || ""),
    "revision_requested",
    "request revision: status should be revision_requested"
  );
  logPass("request revision");

  logStep("reject application");
  const rejectResponse = await adminClient.request(
    `/api/admin/store-applications/${rejectApplicationId}/reject`,
    {
      method: "PATCH",
      body: JSON.stringify({
        rejectReason: "Seller category and compliance declaration are not acceptable.",
        internalAdminNote: "Compliance rejection smoke.",
      }),
    }
  );
  assertStatus(rejectResponse, 200, "reject application");
  assert.equal(
    String(rejectResponse.body?.data?.status || ""),
    "rejected",
    "reject application: status should be rejected"
  );
  logPass("reject application");

  logStep("approve application");
  const approveResponse = await adminClient.request(
    `/api/admin/store-applications/${approveApplicationId}/approve`,
    {
      method: "PATCH",
      body: JSON.stringify({
        internalAdminNote: "Approved in smoke review queue.",
      }),
    }
  );
  assertStatus(approveResponse, 200, "approve application");
  assert.equal(
    String(approveResponse.body?.data?.status || ""),
    "approved",
    "approve application: status should be approved"
  );
  logPass("approve application");

  console.log("[mvf-admin-store-application] OK");
}

run()
  .catch((error) => {
    console.error("[mvf-admin-store-application] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-admin-store-application] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
