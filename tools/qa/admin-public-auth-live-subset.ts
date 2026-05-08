import assert from "node:assert/strict";
import crypto from "node:crypto";
import net from "node:net";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const APP_HOST = "127.0.0.1";
const API_PORT = 3001;
const CLIENT_PORT = 5173;
let clientBase = "";
let clientOrigin = "";
const serverEnvPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../server/.env"
);

loadEnv({ path: serverEnvPath });

let app: any;
let User: any;
let UserRegistrationVerification: any;
let sequelize: any;

type FixtureUser = {
  id: number;
  email: string;
  password: string;
};

const APPROVER_PASSWORD = "ApprovePass123!";
const APPROVER_PASSWORD_HASH = "$2b$10$6GdIiNYZU5wvSUnwpql.HOT88wl.2dAgmyi.qiGjbWu3iP385llt2";
const ADMIN_SIGNUP_MIN_DELAY_MS = 4200;

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
    this.server.listen(0, APP_HOST);
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

  async waitForNextMessage(previousCount: number, timeoutMs = 10000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      if (this.messages.length > previousCount) {
        return this.messages[this.messages.length - 1] || "";
      }
      await delay(100);
    }
    throw new Error("Timed out waiting for email in SMTP sink");
  }
}

const RUN_ID = `admin-public-auth-live-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
const createdUserIds: number[] = [];
const createdVerificationIds: number[] = [];

const log = (message: string) => {
  console.log(`[admin-public-auth-live-subset] ${message}`);
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

const withTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number, label: string) => {
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  });
  return Promise.race([fn(), timeout]) as Promise<T>;
};

const hashToken = (token: string) => {
  const secret = process.env.JWT_SECRET || "dev-secret";
  return crypto.createHash("sha256").update(`${secret}:${token}`).digest("hex");
};

const waitFor = async (url: string, timeoutMs = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok) return true;
    } catch {
      // retry
    }
    await delay(500);
  }
  return false;
};

const getFreePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, APP_HOST, () => {
      const address = server.address();
      if (!address || typeof address !== "object") {
        server.close();
        reject(new Error("Unable to allocate preview port."));
        return;
      }
      const port = Number(address.port);
      server.close(() => resolve(port));
    });
    server.on("error", reject);
  });

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    throw new Error("Playwright is not installed. Run `pnpm qa:ui:install` first.");
  }
};

const stopProcessTree = (proc: any) =>
  new Promise<void>((resolve) => {
    if (!proc || proc.killed) return resolve();
    if (process.platform === "win32") {
      const killer = spawn("taskkill", ["/PID", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      return;
    }
    proc.kill("SIGINT");
    setTimeout(() => {
      if (!proc.killed) proc.kill("SIGKILL");
      resolve();
    }, 5000);
  });

async function ensurePortAvailable(port: number) {
  return new Promise<void>((resolve, reject) => {
    const tester = net.createServer();
    tester.once("error", (error: any) => {
      reject(new Error(`Port ${port} is unavailable: ${error?.message || error}`));
    });
    tester.once("listening", () => {
      tester.close(() => resolve());
    });
    tester.listen(port, APP_HOST);
  });
}

function extractTokenFromMessage(message: string) {
  const normalized = String(message || "")
    .replace(/=\r?\n/g, "")
    .replace(/=3D/gi, "=")
    .replace(/=\s+/g, "");
  const match = normalized.match(/token=([a-f0-9]{64})/i);
  assert.ok(match, "email did not contain expected token");
  return String(match?.[1] || "");
}

async function issueLiveVerificationToken(userId: number) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const record = await UserRegistrationVerification.create({
    userId,
    publicId: `adminverify_${crypto.randomBytes(16).toString("hex")}`,
    status: "PENDING",
    otpHash: hashToken(rawToken),
    otpExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    resendAvailableAt: new Date(),
    lastSentAt: new Date(),
    attempts: 0,
    maxAttempts: 5,
    resendCount: 0,
    maxResends: 5,
    lastDeliveryError: null,
  } as any);
  createdVerificationIds.push(Number(record.getDataValue("id")));
  return rawToken;
}

async function createSuperAdminFixture(password: string) {
  const user = await User.create({
    name: "Live QA Super Admin",
    email: `${RUN_ID}-super-admin@example.test`,
    password: APPROVER_PASSWORD_HASH,
    role: "super_admin",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return {
    id,
    email: String(user.getDataValue("email")),
    password,
  };
}

async function findUserByEmail(email: string) {
  const user = await User.findOne({ where: { email } });
  if (user) {
    createdUserIds.push(Number(user.getDataValue("id")));
  }
  return user;
}

async function trackVerificationRecords(userId: number) {
  const records = await UserRegistrationVerification.findAll({
    where: { userId },
    order: [["updatedAt", "DESC"]],
  });
  for (const record of records) {
    createdVerificationIds.push(Number(record.getDataValue("id")));
  }
  return records;
}

async function gotoRoute(page: any, path: string) {
  await page.goto(`${clientBase}${path}`, { waitUntil: "networkidle" });
}

async function expectText(page: any, selector: string, expected: string) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 10000 });
  const started = Date.now();
  let text = await locator.textContent();
  while (!String(text || "").includes(expected) && Date.now() - started < 10000) {
    await delay(250);
    text = await locator.textContent();
  }
  assert.ok(
    String(text || "").includes(expected),
    `Expected "${selector}" to include "${expected}", received "${text}"`
  );
}

async function fillAdminLogin(page: any, email: string, password: string) {
  await page.locator("#admin-login-email").fill(email);
  await page.locator("#admin-login-password").fill(password);
  await page.getByRole("button", { name: "Login" }).click();
}

async function runLiveSubsetScenario(browser: any, smtpSink: SmtpSink) {
  const staffContext = await browser.newContext();
  const approverContext = await browser.newContext();
  const approvedStaffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  const approverPage = await approverContext.newPage();
  const approvedStaffPage = await approvedStaffContext.newPage();

  const superAdmin = await createSuperAdminFixture(APPROVER_PASSWORD);

  try {
    const staffEmail = `${RUN_ID}-staff@example.test`;
    const staffPhone = `+62812${String(Date.now()).slice(-8)}`;
    const staffPassword = "StaffPass123!";

    log("create account via browser live");
    await gotoRoute(staffPage, "/admin/create-account");
    await staffPage.locator("#admin-create-account-name").fill("Live Approval Staff");
    await staffPage.locator("#admin-create-account-email").fill(staffEmail);
    await staffPage.locator("#admin-create-account-phone").fill(staffPhone);
    await staffPage.locator("#admin-create-account-password").fill(staffPassword);
    await staffPage.locator("#admin-create-account-password-confirm").fill(staffPassword);
    await delay(ADMIN_SIGNUP_MIN_DELAY_MS);
    await staffPage.getByRole("button", { name: "Create account" }).click();
    await expectText(
      staffPage,
      "#admin-create-account-status",
      "Check your email to verify your staff account."
    );
    const createdUser = await findUserByEmail(staffEmail);
    assert.ok(createdUser, "live subset should create staff user");
    assert.equal(String(createdUser?.getDataValue("status") || ""), "pending_verification");
    await trackVerificationRecords(Number(createdUser?.getDataValue("id")));
    const verifyToken = await issueLiveVerificationToken(Number(createdUser?.getDataValue("id")));

    log("verify valid produces pending approval");
    await gotoRoute(staffPage, `/admin/verify-account?token=${verifyToken}`);
    await expectText(
      staffPage,
      "#admin-verify-account-status",
      "waiting for Admin Workspace approval before you can sign in"
    );

    await createdUser?.reload();
    assert.equal(
      String(createdUser?.getDataValue("status") || ""),
      "pending_approval",
      "verified live user should become pending approval"
    );

    log("login remains blocked while pending approval");
    await gotoRoute(staffPage, "/admin/login");
    await fillAdminLogin(staffPage, staffEmail, staffPassword);
    await expectText(
      staffPage,
      "#admin-login-error",
      "still waiting for Admin Workspace approval"
    );

    log("approve via All Accounts using live backend");
    await gotoRoute(approverPage, "/admin/login");
    await fillAdminLogin(approverPage, superAdmin.email, superAdmin.password);
    await approverPage.waitForURL(/\/admin(\/|$)/, { timeout: 10000 });
    await approverPage.locator('a[href="/admin/all-accounts"]').first().click();
    await approverPage.waitForURL(/\/admin\/all-accounts$/, { timeout: 10000 });
    await approverPage.getByRole("heading", { name: "All Accounts" }).waitFor({
      state: "visible",
      timeout: 10000,
    });
    await approverPage.getByText(staffEmail).first().waitFor({ state: "visible", timeout: 10000 });
    await approverPage.getByRole("button", { name: "Approve Live Approval Staff" }).click();
    await expectText(approverPage, "#admin-staff-notice", "Staff account approved.");

    await createdUser?.reload();
    assert.equal(
      String(createdUser?.getDataValue("status") || ""),
      "active",
      "approved live user should become active"
    );

    log("login allowed after approval");
    await gotoRoute(approvedStaffPage, "/admin/login");
    await fillAdminLogin(approvedStaffPage, staffEmail, staffPassword);
    await approvedStaffPage.waitForURL((url: URL) => {
      const path = url.pathname;
      return path === "/admin" || path === "/admin/dashboard";
    }, { timeout: 10000 });

    console.log("[admin-public-auth-live-subset] OK");
  } finally {
    await approvedStaffPage.close().catch(() => null);
    await approverPage.close().catch(() => null);
    await staffPage.close().catch(() => null);
    await approvedStaffContext.close().catch(() => null);
    await approverContext.close().catch(() => null);
    await staffContext.close().catch(() => null);
  }
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

async function main() {
  let clientProc: any = null;
  let backendServer: any = null;
  const smtpSink = new SmtpSink();
  let browser: any = null;

  try {
    await ensurePortAvailable(API_PORT);
    await smtpSink.start();

    await ensurePortAvailable(CLIENT_PORT);
    clientOrigin = `http://localhost:${CLIENT_PORT}`;
    clientBase = clientOrigin;

    await withEnv(
      {
        EMAIL_HOST: APP_HOST,
        EMAIL_PORT: String(smtpSink.port),
        EMAIL_SECURE: "false",
        EMAIL_USER: "mvf",
        EMAIL_PASS: "mvf",
        EMAIL_FROM: "MVF <no-reply@example.test>",
        COOKIE_SECURE: "false",
        CLIENT_URL: clientOrigin,
        CORS_ORIGIN: `${clientOrigin},http://${APP_HOST}:${CLIENT_PORT}`,
        ADMIN_VERIFY_URL: `${clientBase}/admin/verify-account`,
        ADMIN_PASSWORD_RESET_URL: `${clientBase}/admin/reset-password`,
        ADMIN_LOGIN_URL: `${clientBase}/admin/login`,
        NODE_ENV: "development",
      },
      async () => {
        if (!app || !User || !UserRegistrationVerification || !sequelize) {
          const appModule = await import("../../server/src/app.js");
          const modelsModule = await import("../../server/src/models/index.js");
          app = appModule.default;
          User = modelsModule.User;
          UserRegistrationVerification = modelsModule.UserRegistrationVerification;
          sequelize = modelsModule.sequelize;
        }

        await sequelize.authenticate();
        backendServer = app.listen(API_PORT, APP_HOST);
        await once(backendServer, "listening");

        clientProc = spawn(
          "pnpm",
          ["-F", "client", "dev", "--host", APP_HOST, "--port", String(CLIENT_PORT), "--strictPort"],
          {
            stdio: "inherit",
            shell: true,
          }
        );

        const apiReady = await withTimeout(
          () => waitFor(`http://${APP_HOST}:${API_PORT}/api/auth/health`, 30000),
          35000,
          "backend app"
        );
        if (!apiReady) {
          throw new Error("Backend app did not respond on /api/auth/health.");
        }

        const clientReady = await withTimeout(() => waitFor(clientBase, 60000), 70000, "client app");
        if (!clientReady) {
          throw new Error("Client dev server did not respond.");
        }

        const { chromium } = await ensurePlaywright();
        browser = await chromium.launch({ headless: true });
        await runLiveSubsetScenario(browser, smtpSink);
      }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
    if (clientProc) {
      await stopProcessTree(clientProc);
    }
    if (backendServer) {
      backendServer.close();
      await once(backendServer, "close").catch(() => null);
    }
    await smtpSink.stop().catch(() => null);
    await cleanupFixtures().catch(() => null);
    await sequelize.close().catch(() => null);
  }
}

main().catch((error) => {
  console.error("[admin-public-auth-live-subset] FAIL", error);
  process.exitCode = 1;
});
