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
        "Then re-run: pnpm qa:auth:frontend",
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
  let authMeMode: "guest" | "account" | "admin" = "guest";
  let authMeQueue: Array<"guest" | "account" | "admin"> = [];
  let loginAttempts = 0;
  page.on("pageerror", (error: Error) => {
    console.error("[auth-frontend-smoke][pageerror]", error.message);
    if (error?.stack) {
      console.error(error.stack);
    }
  });
  page.on("console", (message: any) => {
    if (message.type() === "error") {
      console.error("[auth-frontend-smoke][console:error]", message.text());
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
      const effectiveAuthMeMode = authMeQueue.length > 0 ? authMeQueue.shift() || authMeMode : authMeMode;
      if (effectiveAuthMeMode === "account" || effectiveAuthMeMode === "admin") {
        return route.fulfill(
          json({
            success: true,
            data: {
              user: {
                id: effectiveAuthMeMode === "admin" ? 1 : 99,
                name: effectiveAuthMeMode === "admin" ? "QA Admin" : "QA Buyer",
                email:
                  effectiveAuthMeMode === "admin"
                    ? "qa-admin@example.test"
                    : "qa-buyer@example.test",
                role: effectiveAuthMeMode === "admin" ? "admin" : "customer",
                status: "active",
              },
            },
          })
        );
      }
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

    if (path === "/api/auth/login" && method === "POST") {
      loginAttempts += 1;
      if (loginAttempts === 1) {
        return route.fulfill(
          json(
            {
              success: false,
              message: "Invalid credentials",
            },
            401
          )
        );
      }
      return route.fulfill(
        json(
          {
            success: false,
            code: "RATE_LIMITED",
            message: "Please wait before trying again.",
            data: {
              retryAfterSeconds: 45,
            },
          },
          429
        )
      );
    }

    if (path === "/api/auth/register" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: true,
            message: "Verification code sent to your email.",
            data: {
              pendingRegistration: {
                registration: {
                  status: "PENDING_VERIFICATION",
                  email: "qa***@e***.test",
                  phoneNumber: "+6281234567890",
                },
                verification: {
                  verificationId: "qa_verify_1",
                  channel: "EMAIL",
                  destinationMasked: "qa***@e***.test",
                  deliveryStatus: "SENT",
                  canSubmitOtp: true,
                  expiresInSeconds: 600,
                  resendAvailableInSeconds: 0,
                },
              },
            },
          },
          202
        )
      );
    }

    if (path === "/api/auth/register/resend-otp" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: false,
            code: "RATE_LIMITED",
            message: "Please wait before requesting another code.",
            data: {
              retryAfterSeconds: 90,
              pending: {
                verification: {
                  verificationId: "qa_verify_1",
                  channel: "EMAIL",
                  destinationMasked: "qa***@e***.test",
                  deliveryStatus: "SENT",
                  canSubmitOtp: true,
                  expiresInSeconds: 600,
                  resendAvailableInSeconds: 90,
                },
              },
            },
          },
          429
        )
      );
    }

    if (path === "/api/auth/register/verify-otp" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: false,
            code: "OTP_INVALID_OR_EXPIRED",
            message: "The verification code is invalid or expired.",
            data: {
              pending: {
                verification: {
                  verificationId: "qa_verify_1",
                  channel: "EMAIL",
                  destinationMasked: "qa***@e***.test",
                  deliveryStatus: "SENT",
                  canSubmitOtp: true,
                  expiresInSeconds: 600,
                  resendAvailableInSeconds: 60,
                },
              },
            },
          },
          400
        )
      );
    }

    if (path === "/api/auth/forgot-password" && method === "POST") {
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

    if (path === "/api/auth/reset-password" && method === "POST") {
      return route.fulfill(
        json(
          {
            success: false,
            code: "RESET_TOKEN_INVALID",
            message: "This reset link is invalid or has expired. Request a new password reset email.",
          },
          400
        )
      );
    }

    if (path === "/api/user/change-password" && method === "POST") {
      return route.fulfill(
        json({
          success: true,
          message: "Password updated. Sign in again with your new password.",
        })
      );
    }

    if (path === "/api/auth/admin/login" && method === "POST") {
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

    if (path === "/api/store/customization" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          customization: {
            home: {
              menuEditor: {
                labels: {
                  categories: "Categories",
                  aboutUs: "About Us",
                  contactUs: "Contact Us",
                  offers: "Offers",
                  faq: "FAQ",
                  privacyPolicy: "Privacy Policy",
                  termsAndConditions: "Terms & Conditions",
                  pages: "Pages",
                  myAccount: "My Account",
                  login: "Login",
                  logout: "Logout",
                  checkout: "Checkout",
                },
                enabled: {
                  showCategories: true,
                  showAboutUs: true,
                  showContactUs: true,
                  showOffers: true,
                  showFaq: true,
                  showPrivacyPolicy: true,
                  showTermsAndConditions: true,
                },
              },
            },
            dashboardSetting: {},
          },
        })
      );
    }

    if (path === "/api/store/customization/header" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            headerText: "Need help?",
            phoneNumber: "+6200000",
            whatsAppLink: "",
            headerLogoUrl: "",
            updatedAt: "2026-04-02T00:00:00.000Z",
          },
        })
      );
    }

    if (path === "/api/store/customization/identity" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            name: "QA Store",
            phone: "+6200000",
            whatsapp: "",
            logoUrl: "",
            updatedAt: "2026-04-02T00:00:00.000Z",
          },
        })
      );
    }

    if (path === "/api/store/settings" && method === "GET") {
      return route.fulfill(
        json({
          success: true,
          data: {
            storeSettings: {
              payments: {
                cashOnDeliveryEnabled: false,
                stripeEnabled: false,
                razorPayEnabled: false,
                methods: [],
              },
              socialLogin: {
                googleEnabled: false,
                githubEnabled: false,
                facebookEnabled: false,
              },
              analytics: {
                googleAnalyticsEnabled: false,
                googleAnalyticKey: "",
              },
              chat: {
                tawkEnabled: false,
                tawkPropertyId: "",
                tawkWidgetId: "",
              },
              branding: {
                clientLogoUrl: "",
                adminLogoUrl: "",
                sellerLogoUrl: "",
                workspaceBrandName: "QA Store",
              },
            },
          },
        })
      );
    }

    if (path === "/api/store/categories" && method === "GET") {
      return route.fulfill(json({ success: true, data: [] }));
    }

    if (path === "/api/cart" && method === "GET") {
      return route.fulfill(json({ success: true, data: { items: [] } }));
    }

    if (path.startsWith("/api/store/") || path.startsWith("/api/user/") || path.startsWith("/api/public/")) {
      return route.fulfill(json({ success: true, data: {} }));
    }

    return route.fulfill(json({ success: true, data: {} }));
  });

  await page.exposeFunction(
    "__setAuthMeMode",
    async (mode: "guest" | "account" | "admin") => {
      authMeQueue = [];
      authMeMode = mode;
    }
  );
  await page.exposeFunction(
    "__setAuthMeQueue",
    async (modes: Array<"guest" | "account" | "admin">) => {
      authMeQueue = Array.isArray(modes) ? [...modes] : [];
    }
  );
}

async function setAuthMeMode(page: any, mode: "guest" | "account" | "admin") {
  await page.evaluate(async (nextMode) => {
    await (window as any).__setAuthMeMode(nextMode);
  }, mode);
}

async function setAuthMeQueue(
  page: any,
  modes: Array<"guest" | "account" | "admin">
) {
  await page.evaluate(async (nextModes) => {
    await (window as any).__setAuthMeQueue(nextModes);
  }, modes);
}

async function gotoRoute(page: any, path: string) {
  await page.goto(`${appBase}${path}`, { waitUntil: "networkidle" });
}

async function expectNoVisibleText(page: any, selector: string, expected: string) {
  const matches = await page.locator(selector).allTextContents();
  const combined = matches.join(" ");
  assert.ok(
    !combined.includes(expected),
    `Expected "${selector}" to not include "${expected}", received "${combined}"`
  );
}

async function waitForStableUrl(page: any, expectedPath: string, waitMs = 1200) {
  await delay(waitMs);
  const currentPath = new URL(page.url()).pathname;
  assert.equal(currentPath, expectedPath, `Expected URL to remain at ${expectedPath}, received ${currentPath}`);
}

async function runBuyerSessionExpiryScenario(page: any) {
  log("[auth-frontend-smoke] buyer protected route redirects stale session to login");
  await page.addInitScript(() => {
    localStorage.setItem("authSessionHint", "true");
  });
  await setAuthMeMode(page, "guest");
  await gotoRoute(page, "/user/dashboard");
  await page.waitForURL(/\/auth\/login/);
  await expectText(
    page,
    "#store-login-status",
    "Your session is no longer valid. Sign in again to continue."
  );
  await waitForStableUrl(page, "/auth/login");
}

async function runAdminSessionExpiryScenario(page: any) {
  log("[auth-frontend-smoke] admin protected route redirects stale session to login");
  await page.addInitScript(() => {
    localStorage.setItem("authSessionHint", "true");
  });
  await setAuthMeMode(page, "guest");
  await setAuthMeQueue(page, ["admin", "guest"]);
  await gotoRoute(page, "/admin");
  await page.waitForURL(/\/admin\/login/);
  await expectText(
    page,
    "#admin-login-notice",
    "Your session is no longer valid. Sign in again to continue."
  );
  await waitForStableUrl(page, "/admin/login");
}

async function runLoginScenario(page: any) {
  log("[auth-frontend-smoke] login error + cooldown notice");
  await setAuthMeMode(page, "guest");
  await gotoRoute(page, "/auth/login");
  await page.locator("#store-login-email").waitFor({ state: "visible", timeout: 10000 });

  await page.locator("#store-login-email").fill("qa@example.test");
  await page.locator("#store-login-password").fill("wrongpass123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expectText(page, "#store-login-error", "Invalid credentials");
  await expectNoVisibleText(
    page,
    "#store-login-status",
    "Your session is no longer valid. Sign in again to continue."
  );

  await page.getByRole("button", { name: "Sign in" }).click();
  await expectText(page, "#store-login-error", "Too many attempts. Try again in");
  const buttonText = await page.getByRole("button", { name: /Try again in/ }).textContent();
  assert.ok(buttonText?.includes("45s"), "login cooldown button label should expose seconds");
}

async function runRegisterScenario(page: any) {
  log("[auth-frontend-smoke] register pending verification + resend cooldown");
  await gotoRoute(page, "/auth/register");
  await page.locator("#store-register-name").waitFor({ state: "visible", timeout: 10000 });

  await page.locator("#store-register-name").fill("QA Register");
  await page.locator("#store-register-email").fill("qa-register@example.test");
  await page.locator("#store-register-phone").fill("+6281234567890");
  await page.locator("#store-register-password").fill("Register123!");
  await page.locator("#store-register-password-confirm").fill("Register123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to verification" }).click();

  await expectText(page, "#store-register-status", "Verification code sent to your email.");
  await page.locator("#store-register-otp").fill("123456");
  await page.getByRole("button", { name: "Resend verification code" }).click();
  await expectText(page, "#store-register-status", "Please wait");
  const resendText = await page.getByRole("button").filter({ hasText: "Resend code in" }).textContent();
  assert.ok(resendText?.includes("90s"), "resend cooldown button label should expose seconds");
}

async function runForgotPasswordScenario(page: any) {
  log("[auth-frontend-smoke] forgot password generic success");
  await gotoRoute(page, "/auth/forgot-password");
  await page.locator("#forgot-password-email").waitFor({ state: "visible", timeout: 10000 });
  await page.locator("#forgot-password-email").fill("qa-forgot@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expectText(
    page,
    "#forgot-password-status",
    "If the email is registered, we have sent a password reset link."
  );
}

async function runResetPasswordScenario(page: any) {
  log("[auth-frontend-smoke] reset password invalid token state");
  await gotoRoute(page, `/auth/reset-password?token=${"a".repeat(64)}`);
  await page.locator("#reset-password-new").fill("NextPass123!");
  await page.locator("#reset-password-confirm").fill("NextPass123!");
  await page.getByRole("button", { name: "Reset password" }).click();
  await expectText(
    page,
    "#reset-password-status",
    "This reset link is invalid or has expired. Request a new password reset email."
  );
}

async function runChangePasswordScenario(page: any) {
  log("[auth-frontend-smoke] change password success redirect notice");
  await setAuthMeMode(page, "account");
  await page.addInitScript(() => {
    localStorage.setItem("authSessionHint", "true");
  });
  await gotoRoute(page, "/user/change-password");
  await page.locator("#account-current-password").waitFor({ state: "visible", timeout: 10000 });

  await page.locator("#account-current-password").fill("Current123!");
  await page.locator("#account-new-password").fill("NextPass123!");
  await page.locator("#account-confirm-password").fill("NextPass123!");
  await page.getByRole("button", { name: /Change Password|Updating password/ }).click();

  await page.waitForURL(/\/auth\/login/);
  await expectText(
    page,
    "#store-login-status",
    "Password updated. Sign in again with your new password."
  );
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

    await runScenario(runBuyerSessionExpiryScenario);
    await runScenario(runAdminSessionExpiryScenario);
    await runScenario(runLoginScenario);
    await runScenario(runRegisterScenario);
    await runScenario(runForgotPasswordScenario);
    await runScenario(runResetPasswordScenario);
    await runScenario(runChangePasswordScenario);
    console.log("[auth-frontend-smoke] OK");
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
    exitWith(`Auth frontend QA failed: ${failure?.message || failure}`);
  }
}

main();
