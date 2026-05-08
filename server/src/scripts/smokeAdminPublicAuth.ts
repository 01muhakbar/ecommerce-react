import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import crypto from "node:crypto";
import net from "node:net";
import { once } from "node:events";
import { Op } from "sequelize";
import app from "../app.js";
import { User, UserRegistrationVerification, sequelize } from "../models/index.js";

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
  headers: Headers;
};

class CookieClient {
  private cookie = "";

  constructor(private readonly baseUrl: string) {}

  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) {
      headers.set("Cookie", this.cookie);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
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
      headers: response.headers,
    };
  }
}

class SmtpSink {
  private server = net.createServer();
  private messages: string[] = [];
  port = 0;

  constructor() {
    this.server.on("connection", (socket) => {
      socket.setEncoding("utf8");
      socket.on("error", () => null);
      let buffer = "";
      let dataMode = false;
      let authState: "LOGIN_USERNAME" | "LOGIN_PASSWORD" | null = null;
      let message = "";

      const write = (line: string) => {
        if (socket.destroyed || !socket.writable) return;
        try {
          socket.write(`${line}\r\n`);
        } catch {
          // ignore smoke-only socket errors
        }
      };

      write("220 localhost ESMTP");

      const handleLine = (rawLine: string) => {
        const line = rawLine.replace(/\r?\n$/, "");
        if (dataMode) {
          if (line === ".") {
            this.messages.push(message);
            dataMode = false;
            message = "";
            write("250 Message accepted");
            return;
          }
          message += (line.startsWith("..") ? line.slice(1) : line) + "\n";
          return;
        }

        if (authState === "LOGIN_USERNAME") {
          authState = "LOGIN_PASSWORD";
          write("334 UGFzc3dvcmQ6");
          return;
        }
        if (authState === "LOGIN_PASSWORD") {
          authState = null;
          write("235 Authentication successful");
          return;
        }

        const upper = line.toUpperCase();
        if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
          socket.write("250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n");
          return;
        }
        if (upper.startsWith("AUTH PLAIN")) {
          write("235 Authentication successful");
          return;
        }
        if (upper === "AUTH LOGIN") {
          authState = "LOGIN_USERNAME";
          write("334 VXNlcm5hbWU6");
          return;
        }
        if (upper.startsWith("AUTH LOGIN ")) {
          authState = "LOGIN_PASSWORD";
          write("334 UGFzc3dvcmQ6");
          return;
        }
        if (
          upper.startsWith("MAIL FROM:") ||
          upper.startsWith("RCPT TO:") ||
          upper === "RSET" ||
          upper === "NOOP"
        ) {
          write("250 OK");
          return;
        }
        if (upper === "DATA") {
          dataMode = true;
          message = "";
          write("354 End data with <CR><LF>.<CR><LF>");
          return;
        }
        if (upper === "QUIT") {
          write("221 Bye");
          socket.end();
          return;
        }
        write("250 OK");
      };

      socket.on("data", (chunk) => {
        buffer += chunk;
        while (buffer.includes("\n")) {
          const index = buffer.indexOf("\n");
          const line = buffer.slice(0, index + 1);
          buffer = buffer.slice(index + 1);
          handleLine(line);
        }
      });
    });
  }

  async start() {
    this.server.listen(0, "127.0.0.1");
    await once(this.server, "listening");
    const address = this.server.address();
    assert.ok(address && typeof address === "object", "smtp sink did not bind");
    this.port = Number(address.port);
  }

  async stop() {
    if (!this.server.listening) return;
    this.server.close();
    await once(this.server, "close");
  }

  count() {
    return this.messages.length;
  }

  lastMessage() {
    return this.messages[this.messages.length - 1] || "";
  }

  async waitForNextMessage(previousCount: number, timeoutMs = 5000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.messages.length > previousCount) {
        return this.lastMessage();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for admin auth email");
  }
}

const RUN_ID = `admin-public-auth-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];
const createdVerificationIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[admin-public-auth-smoke] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[admin-public-auth-smoke] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

const withEnv = async (
  overrides: Record<string, string | undefined>,
  fn: () => Promise<void>
) => {
  const originalEntries = Object.entries(overrides).map(([key]) => [key, process.env[key]] as const);
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await fn();
  } finally {
    for (const [key, value] of originalEntries) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

function createSignupPayload(label: string) {
  const unique = `${RUN_ID}-${label}`;
  return {
    name: `Admin ${label}`,
    email: `${unique}@example.test`,
    phoneNumber: `+62812${String(Date.now()).slice(-8)}`,
    password: "StaffPass123!",
    passwordConfirm: "StaffPass123!",
    honeypot: "",
    startedAt: Date.now() - 10_000,
  };
}

function createForgotPayload(email: string) {
  return {
    email,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  };
}

function createResetPayload(token: string, password = "ResetPass123!") {
  return {
    token,
    password,
    passwordConfirm: password,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  };
}

function extractToken(message: string) {
  const normalized = String(message || "")
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=\s+/g, "");
  const match = normalized.match(/token=([a-f0-9]{64})/i);
  assert.ok(match, "email did not contain expected admin auth token");
  return String(match?.[1] || "");
}

function hashToken(token: string) {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return crypto.createHash("sha256").update(`${secret}:${token}`).digest("hex");
}

async function createFixtureUser(
  role: "seller" | "admin" | "super_admin" | "staff",
  password: string,
  label: string = role,
  status = "active"
) {
  const user = await User.create({
    name: `Admin Public ${label}`,
    email: `${RUN_ID}-${label}@example.test`,
    password: await bcrypt.hash(password, 10),
    role,
    status,
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return {
    id,
    email: String(user.getDataValue("email")),
    password,
    role,
  };
}

async function loginAdminWorkspace(baseUrl: string, email: string, password: string) {
  const client = new CookieClient(baseUrl);
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
  return { client, response };
}

async function findUserByEmail(email: string) {
  const user = await User.findOne({ where: { email } });
  if (user) {
    createdUserIds.push(Number(user.getDataValue("id")));
  }
  return user;
}

async function fetchVerificationRecordsForUser(userId: number, prefix: string) {
  const records = await UserRegistrationVerification.findAll({
    where: {
      userId,
      publicId: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [["updatedAt", "DESC"]],
  });
  for (const record of records) {
    createdVerificationIds.push(Number(record.getDataValue("id")));
  }
  return records;
}

async function runSignupAndVerifyScenario(client: CookieClient, smtpSink: SmtpSink) {
  logStep("self-signup creates pending staff account and sends verification email");
  const signupPayload = createSignupPayload("staff");
  const beforeEmailCount = smtpSink.count();
  const registerResponse = await client.request("/api/auth/admin/register", {
    method: "POST",
    body: JSON.stringify(signupPayload),
  });

  assertStatus(registerResponse, 202, "admin self-signup");
  assert.equal(
    String(registerResponse.body?.code || ""),
    "VERIFICATION_REQUIRED",
    "admin self-signup: expected VERIFICATION_REQUIRED"
  );

  const createdUser = await findUserByEmail(signupPayload.email);
  assert.ok(createdUser, "admin self-signup: user should exist");
  assert.equal(String(createdUser?.getDataValue("role") || ""), "staff", "self-signup role must be staff");
  assert.equal(
    String(createdUser?.getDataValue("status") || ""),
    "pending_verification",
    "self-signup user should stay pending until email verification"
  );

  const verificationEmail = await smtpSink.waitForNextMessage(beforeEmailCount);
  const verifyToken = extractToken(verificationEmail);
  const verificationRecords = await fetchVerificationRecordsForUser(
    Number(createdUser?.getDataValue("id")),
    "adminverify_"
  );
  assert.ok(verificationRecords.length > 0, "verification record should exist");
  assert.equal(
    String(verificationRecords[0]?.getDataValue("status") || ""),
    "PENDING",
    "verification record should start pending"
  );
  logPass("staff self-signup pending verification");

  logStep("pending staff can request a resend verification email safely");
  await verificationRecords[0]?.update({
    resendAvailableAt: new Date(Date.now() - 1000),
    status: "PENDING",
  });
  const beforeResendEmailCount = smtpSink.count();
  const resendKnown = await client.request("/api/auth/admin/register/resend-verification", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(signupPayload.email)),
  });
  assertStatus(resendKnown, 202, "known admin resend verification");
  assert.equal(
    String(resendKnown.body?.message || ""),
    "If the account is pending verification, we have sent another verification email.",
    "known admin resend verification generic message mismatch"
  );
  const resendEmail = await smtpSink.waitForNextMessage(beforeResendEmailCount);
  const resentVerifyToken = extractToken(resendEmail);

  const beforeUnknownResendEmailCount = smtpSink.count();
  const resendUnknown = await client.request("/api/auth/admin/register/resend-verification", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(`${RUN_ID}-unknown-resend@example.test`)),
  });
  assertStatus(resendUnknown, 202, "unknown admin resend verification");
  assert.deepEqual(
    resendUnknown.body,
    resendKnown.body,
    "admin resend verification must not leak enumeration differences"
  );
  assert.equal(
    smtpSink.count(),
    beforeUnknownResendEmailCount,
    "unknown admin resend verification must not dispatch email"
  );
  logPass("admin resend verification generic response");

  logStep("unverified staff stays blocked from /admin/login");
  const blockedLogin = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: signupPayload.email,
      password: signupPayload.password,
    }),
  });
  assertStatus(blockedLogin, 403, "unverified admin login");
  assert.equal(
    String(blockedLogin.body?.code || ""),
    "VERIFICATION_REQUIRED",
    "unverified admin login should require verification"
  );
  logPass("unverified admin login blocked");

  logStep("valid verification token moves staff account to pending approval");
  const verifyResponse = await client.request(
    `/api/auth/admin/verify-email?token=${encodeURIComponent(resentVerifyToken)}`,
    {
      method: "GET",
    }
  );
  assertStatus(verifyResponse, 200, "verify admin email");
  assert.equal(
    String(verifyResponse.body?.code || ""),
    "APPROVAL_PENDING",
    "verify response code mismatch"
  );
  await createdUser?.reload();
  assert.equal(
    String(createdUser?.getDataValue("status") || ""),
    "pending_approval",
    "verified user should wait for approval"
  );
  logPass("email verification moves account to pending approval");

  logStep("verification token is single-use");
  const verifyReuseResponse = await client.request(
    `/api/auth/admin/verify-email?token=${encodeURIComponent(resentVerifyToken)}`,
    {
      method: "GET",
    }
  );
  assertStatus(verifyReuseResponse, 400, "verify token reuse");
  assert.equal(
    String(verifyReuseResponse.body?.code || ""),
    "VERIFY_TOKEN_INVALID",
    "verify token reuse should fail"
  );

  const invalidVerifyResponse = await client.request(
    "/api/auth/admin/verify-email?token=invalidtokeninvalidtokeninvalidtoken",
    {
      method: "GET",
    }
  );
  assertStatus(invalidVerifyResponse, 400, "invalid verify token");
  assert.equal(
    String(invalidVerifyResponse.body?.code || ""),
    "VERIFY_TOKEN_INVALID",
    "invalid verify token should fail"
  );
  logPass("verification invalid/reuse blocked");

  logStep("verified staff stays blocked until approval");
  const verifiedLogin = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: signupPayload.email,
      password: signupPayload.password,
    }),
  });
  assertStatus(verifiedLogin, 403, "verified staff pending approval login");
  assert.equal(
    String(verifiedLogin.body?.code || ""),
    "APPROVAL_REQUIRED",
    "verified staff should require approval before login"
  );
  logPass("verified staff login blocked until approval");

  return {
    email: signupPayload.email,
    currentPassword: signupPayload.password,
    userId: Number(createdUser?.getDataValue("id")),
  };
}

async function runApprovalScenario(
  baseUrl: string,
  smtpSink: SmtpSink,
  fixture: { email: string; currentPassword: string; userId: number }
) {
  logStep("super admin approves pending staff account");
  const approver = await createFixtureUser("super_admin", "ApprovePass123!", "approver");
  const { client: approverClient, response: approverLogin } = await loginAdminWorkspace(
    baseUrl,
    approver.email,
    approver.password
  );
  assertStatus(approverLogin, 200, "super admin login for approval");

  const beforeApprovalEmailCount = smtpSink.count();
  const approveResponse = await approverClient.request(
    `/api/admin/staff/${fixture.userId}/approve`,
    {
      method: "POST",
    }
  );
  assertStatus(approveResponse, 200, "approve pending staff");
  assert.equal(
    Boolean(approveResponse.body?.data?.approvalEmailSent),
    true,
    "approval email should be sent"
  );
  await smtpSink.waitForNextMessage(beforeApprovalEmailCount);

  const approvedUser = await User.findByPk(fixture.userId);
  assert.ok(approvedUser, "approved user should exist");
  assert.equal(
    String(approvedUser?.getDataValue("status") || ""),
    "active",
    "approved user should become active"
  );
  logPass("pending approval account approved successfully");

  logStep("approved staff can now use /admin/login");
  const approvedLogin = await approverClient.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: fixture.currentPassword,
    }),
  });
  assertStatus(approvedLogin, 200, "approved staff admin login");
  assert.equal(String(approvedLogin.body?.user?.role || ""), "staff", "approved staff role mismatch");
  logPass("approved staff admin login succeeds");
}

async function runForgotResetScenario(
  client: CookieClient,
  smtpSink: SmtpSink,
  fixture: { email: string; currentPassword: string; userId: number }
) {
  logStep("admin forgot password stays generic");
  const beforeKnownEmailCount = smtpSink.count();
  const knownResponse = await client.request("/api/auth/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(fixture.email)),
  });
  assertStatus(knownResponse, 202, "known admin forgot password");
  assert.equal(
    String(knownResponse.body?.message || ""),
    "If the email is registered, we have sent a password reset link.",
    "known admin forgot password generic message mismatch"
  );

  const resetEmail = await smtpSink.waitForNextMessage(beforeKnownEmailCount);
  const resetToken = extractToken(resetEmail);
  const resetRecords = await fetchVerificationRecordsForUser(fixture.userId, "adminpwdreset_");
  assert.ok(resetRecords.length > 0, "admin reset record should exist");
  assert.equal(
    String(resetRecords[0]?.getDataValue("status") || ""),
    "PENDING",
    "admin reset record should be pending"
  );

  const beforeUnknownEmailCount = smtpSink.count();
  const unknownResponse = await client.request("/api/auth/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(`${RUN_ID}-unknown@example.test`)),
  });
  assertStatus(unknownResponse, 202, "unknown admin forgot password");
  assert.deepEqual(
    unknownResponse.body,
    knownResponse.body,
    "admin forgot password must not leak enumeration differences"
  );
  assert.equal(
    smtpSink.count(),
    beforeUnknownEmailCount,
    "unknown admin forgot password must not dispatch email"
  );
  logPass("admin forgot password generic response");

  logStep("admin reset password valid token succeeds and token reuse fails");
  const validReset = await client.request("/api/auth/admin/reset-password", {
    method: "POST",
    body: JSON.stringify(createResetPayload(resetToken, "AdminReset123!")),
  });
  assertStatus(validReset, 200, "admin valid reset");
  assert.equal(
    String(validReset.body?.code || ""),
    "PASSWORD_RESET_COMPLETED",
    "admin reset should complete"
  );

  const user = await User.findByPk(fixture.userId);
  assert.ok(user, "admin reset user should still exist");
  const newPasswordMatches = await bcrypt.compare(
    "AdminReset123!",
    String(user?.getDataValue("password") || "")
  );
  assert.equal(newPasswordMatches, true, "new admin password should be stored");

  const reuseReset = await client.request("/api/auth/admin/reset-password", {
    method: "POST",
    body: JSON.stringify(createResetPayload(resetToken, "ReuseReset123!")),
  });
  assertStatus(reuseReset, 400, "admin reset token reuse");
  assert.equal(
    String(reuseReset.body?.code || ""),
    "RESET_TOKEN_INVALID",
    "reused admin reset token should fail"
  );

  const invalidReset = await client.request("/api/auth/admin/reset-password", {
    method: "POST",
    body: JSON.stringify(createResetPayload("invalidtokeninvalidtokeninvalidtoken", "InvalidReset123!")),
  });
  assertStatus(invalidReset, 400, "invalid admin reset token");
  assert.equal(
    String(invalidReset.body?.code || ""),
    "RESET_TOKEN_INVALID",
    "invalid admin reset token should fail"
  );
  logPass("admin reset valid/reuse/invalid coverage");

  logStep("expired admin reset token fails");
  const expiredBeforeEmailCount = smtpSink.count();
  const expiredForgot = await client.request("/api/auth/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(fixture.email)),
  });
  assertStatus(expiredForgot, 202, "expired admin forgot password");
  const expiredEmail = await smtpSink.waitForNextMessage(expiredBeforeEmailCount);
  const expiredToken = extractToken(expiredEmail);
  const expiredRecord = await UserRegistrationVerification.findOne({
    where: {
      userId: fixture.userId,
      publicId: {
        [Op.like]: "adminpwdreset_%",
      },
      otpHash: hashToken(expiredToken),
    },
    order: [["updatedAt", "DESC"]],
  });
  assert.ok(expiredRecord, "expired admin reset record should exist");
  createdVerificationIds.push(Number(expiredRecord?.getDataValue("id")));
  await expiredRecord.update({
    otpExpiresAt: new Date(Date.now() - 60_000),
    status: "PENDING",
  });
  const expiredReset = await client.request("/api/auth/admin/reset-password", {
    method: "POST",
    body: JSON.stringify(createResetPayload(expiredToken, "ExpiredReset123!")),
  });
  assertStatus(expiredReset, 400, "expired admin reset token");
  assert.equal(
    String(expiredReset.body?.code || ""),
    "RESET_TOKEN_INVALID",
    "expired admin reset token should fail"
  );
  logPass("admin reset expired token blocked");

  logStep("new password works for admin login");
  const loginAfterReset = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: "AdminReset123!",
    }),
  });
  assertStatus(loginAfterReset, 200, "admin login after reset");
  assert.equal(
    String(loginAfterReset.body?.user?.role || ""),
    "staff",
    "admin login after reset should still be staff role"
  );
  logPass("admin login after reset succeeds");
}

async function runRoleGuardScenario(baseUrl: string) {
  logStep("seller stays blocked while admin and super admin remain valid");
  const seller = await createFixtureUser("seller", "SellerPass123!");
  const admin = await createFixtureUser("admin", "AdminPass123!");
  const superAdmin = await createFixtureUser("super_admin", "SuperPass123!");

  const sellerClient = new CookieClient(baseUrl);
  const sellerResponse = await sellerClient.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: seller.email,
      password: seller.password,
    }),
  });
  assertStatus(sellerResponse, 403, "seller blocked from admin login");

  const adminClient = new CookieClient(baseUrl);
  const adminResponse = await adminClient.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: admin.email,
      password: admin.password,
    }),
  });
  assertStatus(adminResponse, 200, "admin login remains valid");

  const superAdminClient = new CookieClient(baseUrl);
  const superAdminResponse = await superAdminClient.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: superAdmin.email,
      password: superAdmin.password,
    }),
  });
  assertStatus(superAdminResponse, 200, "super admin login remains valid");
  logPass("seller block preserved without breaking admin roles");
}

async function runInactiveAccountScenario(baseUrl: string, smtpSink: SmtpSink) {
  logStep("inactive admin-workspace account stays blocked with honest messaging");
  const inactiveStaff = await createFixtureUser(
    "staff",
    "InactivePass123!",
    "inactive-staff",
    "inactive"
  );

  const inactiveLoginClient = new CookieClient(baseUrl);
  const inactiveLogin = await inactiveLoginClient.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: inactiveStaff.email,
      password: inactiveStaff.password,
    }),
  });
  assertStatus(inactiveLogin, 403, "inactive admin login");
  assert.equal(
    String(inactiveLogin.body?.code || ""),
    "ACCOUNT_INACTIVE",
    "inactive admin login should return ACCOUNT_INACTIVE"
  );

  const beforeForgotEmailCount = smtpSink.count();
  const forgotInactive = await inactiveLoginClient.request("/api/auth/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(inactiveStaff.email)),
  });
  assertStatus(forgotInactive, 202, "inactive admin forgot password");
  assert.equal(
    String(forgotInactive.body?.message || ""),
    "If the email is registered, we have sent a password reset link.",
    "inactive admin forgot password should stay generic"
  );
  assert.equal(
    smtpSink.count(),
    beforeForgotEmailCount,
    "inactive admin forgot password should not dispatch email"
  );

  const beforeResendEmailCount = smtpSink.count();
  const resendInactive = await inactiveLoginClient.request("/api/auth/admin/register/resend-verification", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(inactiveStaff.email)),
  });
  assertStatus(resendInactive, 202, "inactive admin resend verification");
  assert.equal(
    String(resendInactive.body?.message || ""),
    "If the account is pending verification, we have sent another verification email.",
    "inactive admin resend verification should stay generic"
  );
  assert.equal(
    smtpSink.count(),
    beforeResendEmailCount,
    "inactive admin resend verification should not dispatch email"
  );

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetRecord = await UserRegistrationVerification.create({
    userId: inactiveStaff.id,
    publicId: `adminpwdreset_${crypto.randomBytes(16).toString("hex")}`,
    channel: "EMAIL",
    status: "PENDING",
    otpHash: hashToken(resetToken),
    otpExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    resendAvailableAt: new Date(Date.now() + 60 * 1000),
    lastSentAt: new Date(),
    attempts: 0,
    maxAttempts: 5,
    resendCount: 1,
    maxResends: 5,
    lastAttemptAt: null,
    blockedAt: null,
    consumedAt: null,
    verifiedAt: null,
    lastDeliveryError: null,
  } as any);
  createdVerificationIds.push(Number(resetRecord.getDataValue("id")));

  const inactiveReset = await inactiveLoginClient.request("/api/auth/admin/reset-password", {
    method: "POST",
    body: JSON.stringify(createResetPayload(resetToken, "InactiveReset123!")),
  });
  assertStatus(inactiveReset, 403, "inactive admin reset password");
  assert.equal(
    String(inactiveReset.body?.code || ""),
    "ACCOUNT_INACTIVE",
    "inactive admin reset password should return ACCOUNT_INACTIVE"
  );
  logPass("inactive admin state stays honest across login and recovery flows");
}

async function cleanupFixtures() {
  if (createdVerificationIds.length > 0) {
    await UserRegistrationVerification.destroy({
      where: { id: [...new Set(createdVerificationIds)] } as any,
      force: true,
    }).catch(() => null);
  }
  if (createdUserIds.length > 0) {
    await User.destroy({
      where: { id: [...new Set(createdUserIds)] } as any,
      force: true,
    }).catch(() => null);
  }
}

async function run() {
  await sequelize.authenticate();

  const smtpSink = new SmtpSink();
  await smtpSink.start();

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object", "smoke app failed to bind");
  const baseUrl = `http://127.0.0.1:${Number(address.port)}`;
  const client = new CookieClient(baseUrl);

  try {
    await withEnv(
      {
        EMAIL_HOST: "127.0.0.1",
        EMAIL_PORT: String(smtpSink.port),
        EMAIL_SECURE: "false",
        EMAIL_USER: "mvf",
        EMAIL_PASS: "mvf",
        EMAIL_FROM: "MVF <no-reply@example.test>",
        COOKIE_SECURE: "false",
        CLIENT_URL: baseUrl,
        ADMIN_VERIFY_URL: `${baseUrl}/admin/verify-account`,
        ADMIN_PASSWORD_RESET_URL: `${baseUrl}/admin/reset-password`,
        NODE_ENV: "development",
      },
      async () => {
        const fixture = await runSignupAndVerifyScenario(client, smtpSink);
        await runApprovalScenario(baseUrl, smtpSink, fixture);
        await runForgotResetScenario(client, smtpSink, fixture);
        await runRoleGuardScenario(baseUrl);
        await runInactiveAccountScenario(baseUrl, smtpSink);
      }
    );

    console.log("[admin-public-auth-smoke] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
    await smtpSink.stop().catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[admin-public-auth-smoke] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[admin-public-auth-smoke] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
