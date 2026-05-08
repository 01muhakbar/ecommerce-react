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
        "Then re-run: pnpm qa:admin:staff",
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

type StaffRow = {
  id: number;
  name: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  role: string;
  status?: string;
  isPendingApproval?: boolean;
  sellerRoleCode: string | null;
  permissionKeys: string[];
  isActive: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

const nowIso = () => new Date().toISOString();

const parseMultipartFormData = async (request: any) => {
  const headers = typeof request.headers === "function" ? request.headers() : {};
  const contentType = String(
    headers?.["content-type"] ||
      headers?.["Content-Type"] ||
      (await request.headerValue("content-type")) ||
      ""
  );
  const rawBody = request.postData() || request.postDataBuffer()?.toString("utf8") || "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(rawBody || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  }
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);
  if (!boundaryMatch) return {} as Record<string, string>;
  const boundary = boundaryMatch[1];
  const raw = rawBody;
  const parts = raw.split(`--${boundary}`);
  const data: Record<string, string> = {};

  for (const part of parts) {
    const nameMatch = part.match(/name="([^"]+)"/i);
    if (!nameMatch) continue;
    const name = nameMatch[1];
    const bodyStart = part.indexOf("\r\n\r\n");
    if (bodyStart === -1) continue;
    const value = part.slice(bodyStart + 4).replace(/\r\n--?$/, "").trim();
    data[name] = value;
  }

  return data;
};

function buildListResponse(rows: StaffRow[], page = 1, limit = 10) {
  return {
    rows,
    count: rows.length,
    page,
    limit,
    totalPages: 1,
  };
}

async function installApiMocks(page: any) {
  let nextId = 103;
  const staffRows: StaffRow[] = [
    {
      id: 1,
      name: "QA Super Admin",
      email: "qa-super-admin@example.test",
      phoneNumber: "+62000000",
      avatarUrl: null,
      role: "super_admin",
      sellerRoleCode: null,
      permissionKeys: [],
      isActive: true,
      isPublished: true,
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    },
    {
      id: 101,
      name: "Existing Staff",
      email: "existing.staff@example.test",
      phoneNumber: "+62000001",
      avatarUrl: null,
      role: "staff",
      sellerRoleCode: null,
      permissionKeys: [],
      isActive: true,
      isPublished: true,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    },
    {
      id: 102,
      name: "Pending Approval Staff",
      email: "pending.approval@example.test",
      phoneNumber: "+62000002",
      avatarUrl: null,
      role: "staff",
      sellerRoleCode: null,
      permissionKeys: [],
      status: "pending_approval",
      isPendingApproval: true,
      isActive: false,
      isPublished: true,
      createdAt: "2026-04-02T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    },
  ];

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
        json({
          success: true,
          data: {
            user: {
              id: 1,
              name: "QA Super Admin",
              email: "qa-super-admin@example.test",
              role: "super_admin",
              status: "active",
            },
          },
        })
      );
    }

    if (path === "/api/admin/staff" && method === "GET") {
      const q = String(url.searchParams.get("q") || "").trim().toLowerCase();
      const role = String(url.searchParams.get("role") || "").trim().toLowerCase();
      const filtered = staffRows.filter((row) => {
        if (role && String(row.role || "").toLowerCase() !== role) return false;
        if (!q) return true;
        return [row.name, row.email, row.phoneNumber || ""].join(" ").toLowerCase().includes(q);
      });
      return route.fulfill(json(buildListResponse(filtered)));
    }

    if (path === "/api/admin/staff" && method === "POST") {
      const form = await parseMultipartFormData(request);
      const email = String(form.email || "").trim().toLowerCase();
      const duplicate = staffRows.some((row) => row.email.toLowerCase() === email);
      if (duplicate) {
        return route.fulfill(
          json(
            {
              success: false,
              message: "Email is already used by another account.",
            },
            409
          )
        );
      }

      const createdAt = nowIso();
      const row: StaffRow = {
        id: nextId++,
        name: String(form.name || "").trim(),
        email,
        phoneNumber: String(form.phoneNumber || "").trim() || null,
        avatarUrl: null,
        role: String(form.role || "staff").trim().toLowerCase() || "staff",
        sellerRoleCode: String(form.sellerRoleCode || "").trim() || null,
        permissionKeys: form.permissionKeys ? JSON.parse(String(form.permissionKeys)) : [],
        isActive: String(form.isActive || "true").trim().toLowerCase() !== "false",
        isPublished: true,
        createdAt,
        updatedAt: createdAt,
      };
      staffRows.unshift(row);
      return route.fulfill(json(row, 201));
    }

    const staffPatchMatch = path.match(/^\/api\/admin\/staff\/(\d+)$/);
    if (staffPatchMatch && method === "PATCH") {
      const id = Number(staffPatchMatch[1]);
      const existing = staffRows.find((row) => row.id === id);
      if (!existing) {
        return route.fulfill(json({ success: false, message: "Staff record not found." }, 404));
      }
      const form = await parseMultipartFormData(request);
      if (id === 1 && typeof form.role === "string" && form.role.trim().toLowerCase() !== "super_admin") {
        return route.fulfill(
          json(
            {
              success: false,
              message: "You cannot lower your own role from Super Admin in this account management flow.",
            },
            409
          )
        );
      }
      if (typeof form.name === "string" && form.name.trim()) {
        existing.name = form.name.trim();
      }
      if (typeof form.email === "string" && form.email.trim()) {
        existing.email = form.email.trim().toLowerCase();
      }
      if (Object.prototype.hasOwnProperty.call(form, "phoneNumber")) {
        existing.phoneNumber = String(form.phoneNumber || "").trim() || null;
      }
      if (typeof form.role === "string" && form.role.trim()) {
        existing.role = form.role.trim().toLowerCase();
      }
      if (Object.prototype.hasOwnProperty.call(form, "isActive")) {
        existing.isActive = String(form.isActive).trim().toLowerCase() === "true";
      }
      if (typeof form.sellerRoleCode === "string") {
        existing.sellerRoleCode = form.sellerRoleCode.trim() || null;
      }
      if (typeof form.permissionKeys === "string" && form.permissionKeys.trim()) {
        existing.permissionKeys = JSON.parse(form.permissionKeys);
      } else if (existing.role !== "seller") {
        existing.permissionKeys = [];
        existing.sellerRoleCode = null;
      }
      existing.updatedAt = nowIso();
      return route.fulfill(json(existing));
    }

    const approveMatch = path.match(/^\/api\/admin\/staff\/(\d+)\/approve$/);
    if (approveMatch && method === "POST") {
      const id = Number(approveMatch[1]);
      const existing = staffRows.find((row) => row.id === id);
      if (!existing) {
        return route.fulfill(json({ success: false, message: "Staff account not found." }, 404));
      }
      if (existing.status !== "pending_approval") {
        return route.fulfill(
          json({ success: false, message: "This staff account is not waiting for approval." }, 409)
        );
      }
      existing.status = "active";
      existing.isPendingApproval = false;
      existing.isActive = true;
      existing.updatedAt = nowIso();
      return route.fulfill(
        json({
          success: true,
          message:
            "Staff account approved. pending.approval@example.test can now sign in at /admin/login using the registered email.",
          data: {
            approvalEmailSent: true,
            user: existing,
          },
        })
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

async function runAdminStaffWorkflowScenario(page: any) {
  log("[admin-staff-workflow-smoke] admin staff create/edit workflow");

  await page.addInitScript(() => {
    localStorage.setItem("authSessionHint", "true");
  });

  await gotoRoute(page, "/admin/all-accounts");
  await page.getByRole("heading", { name: "All Accounts" }).waitFor({ state: "visible", timeout: 10000 });
  await expectText(page, "table", "Existing Staff");
  await expectText(page, "table", "Pending Approval Staff");

  await page.getByRole("button", { name: "Approve Pending Approval Staff" }).click();
  await expectText(page, "#admin-staff-notice", "Staff account approved.");
  await expectText(page, "table", "pending.approval@example.test");

  await page.getByRole("button", { name: "Create Account" }).first().click();
  await page.locator("#admin-create-staff-name").fill("QA Staff");
  await page.locator("#admin-create-staff-email").fill("qa-staff@example.test");
  await page.locator("#admin-create-staff-phone").fill("+628123456700");
  await page.locator("#admin-create-staff-password").fill("StaffPass123");
  await page.locator("#admin-create-staff-password-confirm").fill("StaffPass123");
  await page.locator("aside").getByRole("button", { name: "Create Account" }).click();

  await expectText(page, "#admin-staff-notice", "Account created.");
  await expectText(page, "table", "QA Staff");
  await expectText(page, "table", "qa-staff@example.test");

  await page.getByRole("button", { name: "Create Account" }).first().click();
  await page.locator("#admin-create-staff-name").fill("Duplicate Staff");
  await page.locator("#admin-create-staff-email").fill("qa-staff@example.test");
  await page.locator("#admin-create-staff-password").fill("StaffPass123");
  await page.locator("#admin-create-staff-password-confirm").fill("StaffPass123");
  await page.locator("aside").getByRole("button", { name: "Create Account" }).click();

  await expectText(page, "#admin-create-staff-error", "Email is already used by another account.");
  await expectText(page, "table", "QA Staff");

  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Edit QA Staff" }).click();
  await page.locator("#admin-edit-account-role").selectOption("admin");
  await page.locator("#admin-edit-staff-name").fill("QA Staff Updated");
  await page.locator("#admin-edit-staff-phone").fill("+628123456799");
  await page.getByRole("button", { name: "Save Account Changes" }).click();

  await expectText(page, "#admin-staff-notice", "Account updated.");
  await expectText(page, "table", "QA Staff Updated");
  await expectText(page, "table", "+628123456799");
  await expectText(page, "table", "Admin");

  await page.getByRole("button", { name: "Edit QA Super Admin" }).click();
  await page.getByRole("heading", { name: "Update Account" }).waitFor({ state: "visible", timeout: 10000 });
  const drawer = page.locator("aside").last();
  const drawerText = await drawer.textContent();
  assert.ok(
    String(drawerText || "").includes(
      "Your own Super Admin account cannot be lowered from this flow."
    ),
    `Expected self-demotion helper in edit drawer, received "${drawerText}"`
  );
  const selfRoleDisabled = await drawer.locator("#admin-edit-account-role").isDisabled();
  assert.equal(selfRoleDisabled, true);
  const selfStatusDisabled = await drawer.locator('input[type="checkbox"]').isDisabled();
  assert.equal(selfStatusDisabled, true);
  assert.ok(
    String(drawerText || "").includes(
      "Your own account cannot be deactivated from this flow because it would immediately remove your workspace access."
    ),
    `Expected self-deactivate helper in edit drawer, received "${drawerText}"`
  );
  await page.getByRole("button", { name: "Close drawer" }).click();
  const selfDeleteButton = page.getByRole("button", { name: "Delete QA Super Admin" });
  assert.equal(await selfDeleteButton.isDisabled(), true);
}

async function runQa() {
  const { chromium } = await ensurePlaywright();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await installApiMocks(page);
    try {
      await runAdminStaffWorkflowScenario(page);
      console.log("[admin-staff-workflow-smoke] OK");
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
    exitWith(`Admin staff workflow QA failed: ${failure?.message || failure}`);
  }
}

main();
