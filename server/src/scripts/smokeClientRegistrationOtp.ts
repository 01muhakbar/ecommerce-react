import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { once } from "node:events";
import app from "../app.js";
import {
  User,
  UserRegistrationVerification,
  sequelize,
} from "../models/index.js";

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
          // Ignore aborted local SMTP connections in smoke-only sink.
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
    assert.ok(address && typeof address === "object", "smtp sink did not bind to a port");
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
    throw new Error("Timed out waiting for OTP email");
  }
}

const RUN_ID = `mvf-client-reg-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];
const createdVerificationIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-client-registration-otp] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-client-registration-otp] PASS ${label}`);
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

const createRegisterPayload = (label: string) => {
  const unique = `${label}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  return {
    name: `MVF ${label}`,
    email: `${unique}@example.test`,
    phoneNumber: `+62812${String(Date.now()).slice(-8)}`,
    password: "StrongPass123!",
    passwordConfirm: "StrongPass123!",
    termsAccepted: true,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  };
};

const extractOtpCode = (message: string) => {
  const match = message.match(/activate your account:\s*(\d{6})/i);
  assert.ok(match, "otp email did not contain a 6-digit code");
  return String(match?.[1] || "");
};

async function fetchUserByEmail(email: string) {
  const user = await User.findOne({ where: { email } });
  if (user) {
    createdUserIds.push(Number(user.getDataValue("id")));
  }
  return user;
}

async function fetchVerificationForUser(userId: number) {
  const verification = await UserRegistrationVerification.findOne({
    where: { userId },
    order: [["createdAt", "DESC"]],
  });
  if (verification) {
    createdVerificationIds.push(Number(verification.getDataValue("id")));
  }
  return verification;
}

async function runHappyPathScenario(client: CookieClient, smtpSink: SmtpSink) {
  logStep("happy path: register -> pending verification");
  const beforeEmailCount = smtpSink.count();
  const registerPayload = createRegisterPayload("happy");
  const registerResponse = await client.request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(registerPayload),
  });

  assertStatus(registerResponse, 202, "happy register");
  assert.equal(
    registerResponse.headers.has("set-cookie"),
    false,
    "happy register: account should not receive auth cookie before verify"
  );
  assert.equal(
    String(registerResponse.body?.code || ""),
    "VERIFICATION_REQUIRED",
    "happy register: expected VERIFICATION_REQUIRED"
  );
  assert.equal(
    String(registerResponse.body?.data?.pendingRegistration?.registration?.status || ""),
    "PENDING_VERIFICATION",
    "happy register: pending registration status mismatch"
  );
  assert.equal(
    String(registerResponse.body?.data?.pendingRegistration?.verification?.deliveryStatus || ""),
    "SENT",
    "happy register: deliveryStatus should be SENT"
  );
  assert.equal(
    Boolean(registerResponse.body?.data?.pendingRegistration?.verification?.canSubmitOtp),
    true,
    "happy register: canSubmitOtp should be true"
  );

  const user = await fetchUserByEmail(registerPayload.email);
  assert.ok(user, "happy register: user should be created");
  assert.equal(
    String(user?.getDataValue("status") || ""),
    "pending_verification",
    "happy register: user should stay pending"
  );

  const verification = await fetchVerificationForUser(Number(user?.getDataValue("id")));
  assert.ok(verification, "happy register: verification row should exist");
  assert.equal(
    String(verification?.getDataValue("status") || ""),
    "PENDING",
    "happy register: verification row should be PENDING"
  );

  const otpMessage = await smtpSink.waitForNextMessage(beforeEmailCount);
  const otpCode = extractOtpCode(otpMessage);
  logPass("happy path pending state");

  logStep("happy path: verify otp -> active");
  const verifyResponse = await client.request("/api/auth/register/verify-otp", {
    method: "POST",
    body: JSON.stringify({
      verificationId:
        registerResponse.body?.data?.pendingRegistration?.verification?.verificationId,
      otpCode,
    }),
  });

  assertStatus(verifyResponse, 200, "happy verify");
  assert.equal(
    verifyResponse.headers.has("set-cookie"),
    true,
    "happy verify: auth cookie should be issued after OTP success"
  );
  assert.equal(
    String(verifyResponse.body?.data?.user?.status || ""),
    "active",
    "happy verify: user status should be active"
  );

  const meResponse = await client.request("/api/auth/me");
  assertStatus(meResponse, 200, "happy me");
  assert.equal(
    String(meResponse.body?.data?.user?.status || ""),
    "active",
    "happy me: account should now be active"
  );

  await user?.reload();
  await verification?.reload();
  assert.equal(
    String(user?.getDataValue("status") || ""),
    "active",
    "happy verify: db user should be active"
  );
  assert.equal(
    String(verification?.getDataValue("status") || ""),
    "VERIFIED",
    "happy verify: db verification should be VERIFIED"
  );
  assert.ok(verification?.getDataValue("verifiedAt"), "happy verify: verifiedAt should be set");
  assert.ok(verification?.getDataValue("consumedAt"), "happy verify: consumedAt should be set");
  logPass("happy path account activation");
}

async function runDeliveryFailedScenario(client: CookieClient) {
  logStep("failure path: otp delivery failure returns safe pending state");
  const registerPayload = createRegisterPayload("delivery-failed");
  const registerResponse = await client.request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(registerPayload),
  });

  assertStatus(registerResponse, 503, "delivery failed register");
  assert.equal(
    registerResponse.headers.has("set-cookie"),
    false,
    "delivery failed register: auth cookie must not be issued"
  );
  assert.equal(
    String(registerResponse.body?.code || ""),
    "OTP_DELIVERY_FAILED",
    "delivery failed register: expected OTP_DELIVERY_FAILED"
  );
  assert.equal(
    String(registerResponse.body?.data?.pending?.registration?.status || ""),
    "PENDING_VERIFICATION",
    "delivery failed register: pending registration status mismatch"
  );
  assert.equal(
    String(registerResponse.body?.data?.pending?.verification?.deliveryStatus || ""),
    "FAILED",
    "delivery failed register: deliveryStatus should be FAILED"
  );
  assert.equal(
    Boolean(registerResponse.body?.data?.pending?.verification?.canSubmitOtp),
    false,
    "delivery failed register: canSubmitOtp should be false"
  );

  const user = await fetchUserByEmail(registerPayload.email);
  assert.ok(user, "delivery failed register: user should still be created");
  assert.equal(
    String(user?.getDataValue("status") || ""),
    "pending_verification",
    "delivery failed register: user should remain pending"
  );

  const verification = await fetchVerificationForUser(Number(user?.getDataValue("id")));
  assert.ok(verification, "delivery failed register: verification row should exist");
  assert.equal(
    String(verification?.getDataValue("status") || ""),
    "DELIVERY_FAILED",
    "delivery failed register: verification row should be DELIVERY_FAILED"
  );
  assert.ok(
    String(verification?.getDataValue("lastDeliveryError") || "").includes(
      "Email delivery is not configured"
    ),
    "delivery failed register: lastDeliveryError should explain missing email config"
  );
  logPass("failure path pending state");
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
  const client = new CookieClient(`http://127.0.0.1:${Number(address.port)}`);

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
        NODE_ENV: "development",
      },
      async () => {
        await runHappyPathScenario(client, smtpSink);
      }
    );

    await withEnv(
      {
        EMAIL_HOST: undefined,
        EMAIL_PORT: undefined,
        EMAIL_USER: undefined,
        EMAIL_PASS: undefined,
        EMAIL_FROM: undefined,
        COOKIE_SECURE: "false",
        NODE_ENV: "development",
      },
      async () => {
        const deliveryFailedClient = new CookieClient(
          `http://127.0.0.1:${Number(address.port)}`
        );
        await runDeliveryFailedScenario(deliveryFailedClient);
      }
    );

    console.log("[mvf-client-registration-otp] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
    await smtpSink.stop().catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[mvf-client-registration-otp] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[mvf-client-registration-otp] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
