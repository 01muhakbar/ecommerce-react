import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const APP_HOST = "127.0.0.1";
let appBase = "";

const exitWith = (message: string, code = 1) => {
  console.error(message);
  process.exit(code);
};

const log = (message: string) => {
  console.log(message);
};

const withTimeout = async <T>(fn: () => Promise<T>, timeoutMs: number, label: string) => {
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  });
  return Promise.race([fn(), timeout]) as Promise<T>;
};

const waitFor = async (url: string, timeoutMs = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
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
    exitWith(
      [
        "Playwright is not installed.",
        "Run: pnpm qa:ui:install",
        "Then re-run: pnpm qa:admin:public-auth",
      ].join("\n")
    );
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

const json = (body: any, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

async function installApiMocks(page: any) {
  page.on("pageerror", (error: Error) => {
    console.error("[admin-public-auth-frontend-smoke][pageerror]", error.message);
    if (error?.stack) console.error(error.stack);
  });
  page.on("console", (message: any) => {
    if (message.type() === "error") {
      console.error("[admin-public-auth-frontend-smoke][console:error]", message.text());
    }
  });

  await page.route("**/*", async (route: any) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (!path.startsWith("/api/")) {
      return route.continue();
    }

    if (path === "/api/auth/me" && method === "GET") {
      return route.fulfill(
        json(
          {
            success: false,
            message: "Unauthorized",
          },
          401
        )
      );
    }

    if (path === "/api/auth/admin/register" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: true,
            code: "VERIFICATION_REQUIRED",
            message:
              "Check your email to verify your staff account. After verification, Admin Workspace will review and approve your sign-in access.",
          },
          202
        )
      );
    }

    if (path === "/api/auth/admin/verify-email" && method === "GET") {
      return route.fulfill(
        json(
          {
            success: false,
            code: "VERIFY_TOKEN_INVALID",
            message:
              "This verification link is invalid or has expired. Create a new account or request another verification email.",
          },
          400
        )
      );
    }

    if (path === "/api/auth/admin/register/resend-verification" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: true,
            code: "VERIFICATION_REQUIRED",
            message:
              "If the account is pending verification, we have sent another verification email.",
          },
          202
        )
      );
    }

    if (path === "/api/auth/admin/forgot-password" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: true,
            code: "PASSWORD_RESET_REQUESTED",
            message: "If the email is registered, we have sent a password reset link.",
          },
          202
        )
      );
    }

    if (path === "/api/auth/admin/reset-password" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: false,
            code: "RESET_TOKEN_INVALID",
            message:
              "This reset link is invalid or has expired. Request a new password reset email.",
          },
          400
        )
      );
    }

    if (path === "/api/auth/admin/login" && method === "POST") {
      const payload = request.postDataJSON?.() || {};
      if (String(payload?.email || "").trim().toLowerCase() === "inactive.admin@example.test") {
        return route.fulfill(
          json(
            {
              code: "ACCOUNT_INACTIVE",
              message: "This account is inactive. Contact Admin Workspace to restore sign-in access.",
            },
            403
          )
        );
      }
      return route.fulfill(
        json(
          {
            message: "Invalid credentials",
          },
          401
        )
      );
    }

    if (path === "/api/auth/admin/logout" && method === "POST") {
      return route.fulfill(json({ success: true }));
    }

    return route.fulfill(json({ success: true, data: {} }));
  });
}

async function gotoRoute(page: any, path: string) {
  await page.goto(`${appBase}${path}`, { waitUntil: "networkidle" });
}

async function expectText(page: any, selector: string, expected: string) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: "visible", timeout: 10000 });
  const text = await locator.textContent();
  assert.ok(
    String(text || "").includes(expected),
    `Expected "${selector}" to include "${expected}", received "${text}"`
  );
}

async function runCreateAccountScenario(page: any) {
  log("[admin-public-auth-frontend-smoke] create account success / pending verification notice");
  await gotoRoute(page, "/admin/create-account");
  await page.locator("#admin-create-account-name").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#admin-create-account-name").fill("QA Staff");
  await page.locator("#admin-create-account-email").fill("qa-staff@example.test");
  await page.locator("#admin-create-account-phone").fill("+6281234567890");
  await page.locator("#admin-create-account-password").fill("StaffPass123!");
  await page.locator("#admin-create-account-password-confirm").fill("StaffPass123!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expectText(
    page,
    "#admin-create-account-status",
    "Check your email to verify your staff account."
  );
}

async function runVerifyInvalidScenario(page: any) {
  log("[admin-public-auth-frontend-smoke] verify invalid token state");
  await gotoRoute(page, `/admin/verify-account?token=${"a".repeat(64)}`);
  await expectText(
    page,
    "#admin-verify-account-status",
    "This verification link is invalid or has expired."
  );
}

async function runResendVerificationScenario(page: any) {
  log("[admin-public-auth-frontend-smoke] resend verification generic success");
  await gotoRoute(page, "/admin/resend-verification?email=qa-staff@example.test");
  await page.locator("#admin-resend-verification-email").waitFor({ state: "visible", timeout: 10000 });
  await page.getByRole("button", { name: "Resend verification email" }).click();
  await expectText(
    page,
    "#admin-resend-verification-status",
    "If the account is pending verification, we have sent another verification email."
  );
}

async function runForgotPasswordScenario(page: any) {
  log("[admin-public-auth-frontend-smoke] forgot password generic success");
  await gotoRoute(page, "/admin/forgot-password");
  await page.locator("#admin-forgot-password-email").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#admin-forgot-password-email").fill("qa-admin@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expectText(
    page,
    "#admin-forgot-password-status",
    "If the email is registered, we have sent a password reset link."
  );
}

async function runInactiveLoginScenario(page: any) {
  log("[admin-public-auth-frontend-smoke] inactive account login state");
  await gotoRoute(page, "/admin/login");
  await page.locator("#admin-login-email").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#admin-login-email").fill("inactive.admin@example.test");
  await page.locator("#admin-login-password").fill("InactivePass123!");
  await page.getByRole("button", { name: "Login" }).click();
  await expectText(
    page,
    "#admin-login-error",
    "This account is inactive. Contact Admin Workspace to restore sign-in access."
  );
  await expectText(
    page,
    "form",
    "This account is inactive. Contact Admin Workspace if you need sign-in access restored."
  );
}

async function runResetInvalidScenario(page: any) {
  log("[admin-public-auth-frontend-smoke] reset password invalid token state");
  await gotoRoute(page, `/admin/reset-password?token=${"b".repeat(64)}`);
  await page.locator("#admin-reset-password-new").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#admin-reset-password-new").fill("ResetPass123!");
  await page.locator("#admin-reset-password-confirm").fill("ResetPass123!");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expectText(
    page,
    "#admin-reset-password-status",
    "This reset link is invalid or has expired. Request a new password reset email."
  );
}

async function runQa() {
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless: true });

  try {
    const runScenario = async (scenario: (page: any) => Promise<void>) => {
      const page = await browser.newPage();
      await installApiMocks(page);
      try {
        await scenario(page);
      } finally {
        await page.close();
      }
    };

    await runScenario(runCreateAccountScenario);
    await runScenario(runVerifyInvalidScenario);
    await runScenario(runResendVerificationScenario);
    await runScenario(runForgotPasswordScenario);
    await runScenario(runInactiveLoginScenario);
    await runScenario(runResetInvalidScenario);
    console.log("[admin-public-auth-frontend-smoke] OK");
  } finally {
    await browser.close();
  }
}

async function main() {
  let proc: any = null;
  let failure: any = null;
  try {
    const port = await getFreePort();
    appBase = `http://${APP_HOST}:${port}`;
    log("Starting client dev server...");
    proc = spawn("pnpm", ["-F", "client", "dev", "--host", APP_HOST, "--port", String(port), "--strictPort"], {
      stdio: "inherit",
      shell: true,
    });

    const appReady = await withTimeout(() => waitFor(appBase, 60000), 70000, "client app");
    if (!appReady) {
      throw new Error("Client dev server did not respond.");
    }

    await runQa();
  } catch (error: any) {
    failure = error;
  } finally {
    await stopProcessTree(proc);
  }
  if (failure) {
    exitWith(`Admin public auth frontend QA failed: ${failure?.message || failure}`);
  }
}

main();
