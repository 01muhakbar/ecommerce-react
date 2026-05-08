import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const APP_HOST = "127.0.0.1";
const VALID_VERIFY_TOKEN = "c".repeat(64);
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
        "Then re-run: pnpm qa:admin:staff-approval",
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

type MockUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  status: string;
  phoneNumber?: string | null;
  password: string;
};

type StaffRow = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  role: string;
  status: string;
  isPendingApproval: boolean;
  sellerRoleCode: string | null;
  permissionKeys: string[];
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

const nowIso = () => new Date().toISOString();

async function installApiMocks(page: any) {
  const approver: MockUser = {
    id: 1,
    name: "QA Super Admin",
    email: "qa-super-admin@example.test",
    role: "super_admin",
    status: "active",
    phoneNumber: "+62000000",
    password: "ApprovePass123!",
  };
  const pendingStaff: MockUser = {
    id: 201,
    name: "Approval Flow Staff",
    email: "approval.staff@example.test",
    role: "staff",
    status: "pending_verification",
    phoneNumber: "+628123456700",
    password: "StaffPass123!",
  };

  let sessionUser: MockUser | null = null;
  let verifyTokenUsed = false;

  const buildStaffRows = (): StaffRow[] => [
    {
      id: approver.id,
      name: approver.name,
      email: approver.email,
      phoneNumber: approver.phoneNumber || null,
      avatarUrl: null,
      role: approver.role,
      status: approver.status,
      isPendingApproval: false,
      sellerRoleCode: null,
      permissionKeys: [],
      isActive: true,
      isPublished: true,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: nowIso(),
    },
    {
      id: pendingStaff.id,
      name: pendingStaff.name,
      email: pendingStaff.email,
      phoneNumber: pendingStaff.phoneNumber || null,
      avatarUrl: null,
      role: pendingStaff.role,
      status: pendingStaff.status,
      isPendingApproval: pendingStaff.status === "pending_approval",
      sellerRoleCode: null,
      permissionKeys: [],
      isActive: pendingStaff.status === "active",
      isPublished: true,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: nowIso(),
    },
  ];

  page.on("pageerror", (error: Error) => {
    console.error("[admin-staff-approval-workflow-smoke][pageerror]", error.message);
    if (error?.stack) console.error(error.stack);
  });
  page.on("console", (message: any) => {
    if (message.type() === "error") {
      console.error("[admin-staff-approval-workflow-smoke][console:error]", message.text());
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
      if (!sessionUser) {
        return route.fulfill(json({ success: false, message: "Unauthorized" }, 401));
      }
      return route.fulfill(
        json({
          success: true,
          data: {
            user: {
              id: sessionUser.id,
              name: sessionUser.name,
              email: sessionUser.email,
              role: sessionUser.role,
              status: sessionUser.status,
            },
          },
        })
      );
    }

    if (path === "/api/auth/admin/verify-email" && method === "GET") {
      const token = String(url.searchParams.get("token") || "");
      if (token !== VALID_VERIFY_TOKEN || verifyTokenUsed || pendingStaff.status !== "pending_verification") {
        return route.fulfill(
          json(
            {
              success: false,
              code: "VERIFY_TOKEN_INVALID",
              message:
                "This verification link is invalid or has expired. Create a new Staff account or request another verification email.",
            },
            400
          )
        );
      }
      verifyTokenUsed = true;
      pendingStaff.status = "pending_approval";
      return route.fulfill(
        json({
          success: true,
          code: "APPROVAL_PENDING",
          message:
            "Email verified. Your Staff account is now waiting for Admin Workspace approval before you can sign in.",
        })
      );
    }

    if (path === "/api/auth/admin/login" && method === "POST") {
      const payload = request.postDataJSON();
      const email = String(payload?.email || "").trim().toLowerCase();
      const password = String(payload?.password || "");

      if (email === pendingStaff.email && password === pendingStaff.password) {
        if (pendingStaff.status === "pending_verification") {
          return route.fulfill(
            json(
              {
                success: false,
                code: "VERIFICATION_REQUIRED",
                message: "Verify your email before signing in to Admin Workspace.",
              },
              403
            )
          );
        }
        if (pendingStaff.status === "pending_approval") {
          return route.fulfill(
            json(
              {
                success: false,
                code: "APPROVAL_REQUIRED",
                message:
                  "Your email is verified, but this Staff account is still waiting for Admin Workspace approval.",
              },
              403
            )
          );
        }
        sessionUser = { ...pendingStaff };
        return route.fulfill(
          json({
            success: true,
            user: {
              id: pendingStaff.id,
              name: pendingStaff.name,
              email: pendingStaff.email,
              role: pendingStaff.role,
              status: pendingStaff.status,
            },
          })
        );
      }

      if (email === approver.email && password === approver.password) {
        sessionUser = { ...approver };
        return route.fulfill(
          json({
            success: true,
            user: {
              id: approver.id,
              name: approver.name,
              email: approver.email,
              role: approver.role,
              status: approver.status,
            },
          })
        );
      }

      return route.fulfill(json({ success: false, message: "Invalid credentials" }, 401));
    }

    if (path === "/api/auth/admin/logout" && method === "POST") {
      sessionUser = null;
      return route.fulfill(json({ success: true }));
    }

    if (path === "/api/admin/staff" && method === "GET") {
      if (!sessionUser || sessionUser.role !== "super_admin") {
        return route.fulfill(json({ success: false, message: "Forbidden" }, 403));
      }
      return route.fulfill(
        json({
          rows: buildStaffRows(),
          count: 2,
          page: 1,
          limit: 10,
          totalPages: 1,
        })
      );
    }

    const approveMatch = path.match(/^\/api\/admin\/staff\/(\d+)\/approve$/);
    if (approveMatch && method === "POST") {
      if (!sessionUser || sessionUser.role !== "super_admin") {
        return route.fulfill(json({ success: false, message: "Forbidden" }, 403));
      }
      const id = Number(approveMatch[1]);
      if (id !== pendingStaff.id || pendingStaff.status !== "pending_approval") {
        return route.fulfill(
          json({ success: false, message: "This staff account is not waiting for approval." }, 409)
        );
      }
      pendingStaff.status = "active";
      return route.fulfill(
        json({
          success: true,
          message:
            "Staff account approved. approval.staff@example.test can now sign in at /admin/login using the registered email.",
          data: {
            approvalEmailSent: true,
            user: {
              id: pendingStaff.id,
              name: pendingStaff.name,
              email: pendingStaff.email,
              role: pendingStaff.role,
              status: pendingStaff.status,
            },
          },
        })
      );
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

async function runApprovalWorkflowScenario(page: any) {
  log("[admin-staff-approval-workflow-smoke] verify valid -> pending approval");
  await gotoRoute(page, `/admin/verify-account?token=${VALID_VERIFY_TOKEN}`);
  await expectText(
    page,
    "#admin-verify-account-status",
    "waiting for Admin Workspace approval before you can sign in"
  );

  log("[admin-staff-approval-workflow-smoke] login stays blocked before approval");
  await gotoRoute(page, "/admin/login");
  await fillAdminLogin(page, "approval.staff@example.test", "StaffPass123!");
  await expectText(page, "#admin-login-error", "still waiting for Admin Workspace approval");
  await expectText(page, "form", "Wait for Admin Workspace approval before signing in.");
  assert.ok(page.url().includes("/admin/login"), `Expected to remain on /admin/login, received ${page.url()}`);

  log("[admin-staff-approval-workflow-smoke] super admin approves pending account in All Accounts");
  await gotoRoute(page, "/admin/login");
  await fillAdminLogin(page, "qa-super-admin@example.test", "ApprovePass123!");
  await page.waitForURL(/\/admin(\/|$)/, { timeout: 10000 });
  await gotoRoute(page, "/admin/all-accounts");
  await page.getByRole("heading", { name: "All Accounts" }).waitFor({ state: "visible", timeout: 10000 });
  await expectText(page, "table", "Pending approval");
  await page.getByRole("button", { name: "Approve Approval Flow Staff" }).click();
  await expectText(page, "#admin-staff-notice", "Staff account approved.");
  await expectText(page, "table", "Active");

  log("[admin-staff-approval-workflow-smoke] login is allowed after approval");
  await gotoRoute(page, "/admin/login");
  await fillAdminLogin(page, "approval.staff@example.test", "StaffPass123!");
  await page.waitForURL((url: URL) => {
    const path = url.pathname;
    return path === "/admin" || path === "/admin/dashboard";
  }, { timeout: 10000 });
}

async function runQa() {
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await installApiMocks(page);
    try {
      await runApprovalWorkflowScenario(page);
      console.log("[admin-staff-approval-workflow-smoke] OK");
    } finally {
      await page.close();
    }
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
    exitWith(`Admin staff approval workflow QA failed: ${failure?.message || failure}`);
  }
}

main();
