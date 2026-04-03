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
          // ignore smoke-only aborted connections
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
    throw new Error("Timed out waiting for reset email");
  }
}

const RUN_ID = `auth-session-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];
const createdVerificationIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[auth-session-invalidation-smoke] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[auth-session-invalidation-smoke] PASS ${label}`);
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

async function createFixtureUser() {
  const email = `${RUN_ID}@example.test`;
  const user = await User.create({
    name: "Auth Session",
    email,
    password: await bcrypt.hash("StartPass123!", 10),
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email };
}

function createForgotPayload(email: string) {
  return {
    email,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  };
}

function createResetPayload(token: string, password = "NextPass123!") {
  return {
    token,
    password,
    passwordConfirm: password,
    honeypot: "",
    startedAt: Date.now() - 10_000,
  };
}

function extractResetToken(message: string) {
  const normalized = String(message || "")
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=\s+/g, "");
  const match = normalized.match(/token=([a-f0-9]{64})/i);
  assert.ok(match, "reset email did not contain a reset token");
  return String(match?.[1] || "");
}

async function fetchResetRecordsForUser(userId: number) {
  const records = await UserRegistrationVerification.findAll({
    where: {
      userId,
      publicId: {
        [Op.like]: "pwdreset_%",
      },
    },
    order: [["updatedAt", "DESC"]],
  });
  for (const record of records) {
    createdVerificationIds.push(Number(record.getDataValue("id")));
  }
  return records;
}

async function runSessionInvalidationScenario(baseUrl: string, smtpSink: SmtpSink) {
  const fixture = await createFixtureUser();
  const loggedInClient = new CookieClient(baseUrl);
  const freshClient = new CookieClient(baseUrl);

  logStep("login creates a valid session before reset");
  const loginResponse = await loggedInClient.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: "StartPass123!",
    }),
  });
  assertStatus(loginResponse, 200, "initial login");

  const beforeResetMe = await loggedInClient.request("/api/auth/me");
  assertStatus(beforeResetMe, 200, "auth me before reset");
  logPass("initial session valid");

  logStep("forgot password issues reset token");
  const previousMessageCount = smtpSink.count();
  const forgotResponse = await freshClient.request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(createForgotPayload(fixture.email)),
  });
  assertStatus(forgotResponse, 202, "forgot password request");
  const resetEmail = await smtpSink.waitForNextMessage(previousMessageCount);
  const token = extractResetToken(resetEmail);
  const records = await fetchResetRecordsForUser(fixture.id);
  assert.ok(records[0], "forgot password should create a reset record");
  logPass("reset token issued");

  logStep("reset password invalidates the previous session");
  const resetResponse = await freshClient.request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(createResetPayload(token, "NextPass123!")),
  });
  assertStatus(resetResponse, 200, "reset password");

  const oldSessionResponse = await loggedInClient.request("/api/auth/me");
  assertStatus(oldSessionResponse, 401, "old session after reset");
  logPass("old session invalidated");

  logStep("old password stops working and new password can log in");
  const oldPasswordLogin = await freshClient.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: "StartPass123!",
    }),
  });
  assertStatus(oldPasswordLogin, 401, "old password login");

  const newLogin = await freshClient.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: fixture.email,
      password: "NextPass123!",
    }),
  });
  assertStatus(newLogin, 200, "new password login");

  const newSessionResponse = await freshClient.request("/api/auth/me");
  assertStatus(newSessionResponse, 200, "new session after reset");
  logPass("new password login succeeds");
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
        NODE_ENV: "development",
      },
      async () => {
        await runSessionInvalidationScenario(baseUrl, smtpSink);
      }
    );

    console.log("[auth-session-invalidation-smoke] OK");
  } finally {
    server.close();
    await once(server, "close").catch(() => null);
    await smtpSink.stop().catch(() => null);
  }
}

run()
  .catch((error) => {
    console.error("[auth-session-invalidation-smoke] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupFixtures().catch((cleanupError) => {
      console.error("[auth-session-invalidation-smoke] cleanup failed", cleanupError);
      process.exitCode = 1;
    });
    await sequelize.close().catch(() => null);
  });
