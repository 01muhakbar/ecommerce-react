import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const API_BASE = "http://localhost:3001";
const APP_BASE = "http://localhost:5173";
const HEALTH_URL = `${API_BASE}/api/health`;

const REQUIRED_HEADERS = [
  "ORDER ID",
  "ORDERTIME",
  "METHOD",
  "STATUS",
  "SHIPPING",
  "SHIPPING COST",
  "TOTAL",
  "ACTION",
];

const exitWith = (message, code = 1) => {
  // eslint-disable-next-line no-console
  console.error(message);
  process.exit(code);
};

const log = (message) => {
  // eslint-disable-next-line no-console
  console.log(message);
};

const withTimeout = async (fn, timeoutMs, label) => {
  const timeout = delay(timeoutMs).then(() => {
    throw new Error(`${label} timed out after ${timeoutMs}ms`);
  });
  return Promise.race([fn(), timeout]);
};

const waitFor = async (url, timeoutMs = 60000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {
      // retry
    }
    await delay(1000);
  }
  return false;
};

const ensurePlaywright = async () => {
  try {
    return await import("playwright");
  } catch {
    exitWith(
      [
        "Playwright is not installed.",
        "Run: pnpm qa:ui:install",
        "Then re-run: pnpm qa:ui",
      ].join("\n")
    );
  }
};

const pickProductId = (payload) => {
  const data = payload?.data;
  if (Array.isArray(data)) return data[0]?.id ?? null;
  if (Array.isArray(data?.items)) return data.items[0]?.id ?? null;
  if (Array.isArray(data?.data)) return data.data[0]?.id ?? null;
  if (Array.isArray(payload?.products)) return payload.products[0]?.id ?? null;
  if (Array.isArray(payload?.data?.products)) return payload.data.products[0]?.id ?? null;
  return null;
};

const createOrder = async (token) => {
  const productsResp = await fetch(`${API_BASE}/api/store/products?page=1&limit=1`);
  const productsJson = await productsResp.json();
  const productId = pickProductId(productsJson);
  if (!productId) {
    throw new Error("Unable to resolve productId for test order.");
  }

  const orderResp = await fetch(`${API_BASE}/api/store/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: JSON.stringify({
      customer: { name: "QA Customer", phone: "0800000000", address: "QA Street 1" },
      paymentMethod: "COD",
      items: [{ productId, qty: 1 }],
    }),
  });

  if (!orderResp.ok) {
    const body = await orderResp.text();
    throw new Error(`Failed to create order: ${orderResp.status} ${body}`);
  }

  const payload = await orderResp.json();
  const data = payload?.data ?? payload;
  const ref = data?.invoiceNo ?? data?.ref ?? data?.invoice ?? data?.id;
  if (!ref) {
    throw new Error("Order reference missing in create order response.");
  }
  return { ref: String(ref), productId: Number(productId) };
};

const createReview = async (token, productId) => {
  const reviewResp = await fetch(
    `${API_BASE}/api/store/reviews/product/${productId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `token=${token}`,
      },
      body: JSON.stringify({
        rating: 5,
        comment: "QA review",
        images: [],
      }),
    }
  );
  if (!reviewResp.ok) {
    const body = await reviewResp.text();
    throw new Error(`Failed to create review: ${reviewResp.status} ${body}`);
  }
};

const registerAndLogin = async () => {
  const email = `qa_${Date.now()}@local.dev`;
  const password = "customer123";
  const name = "QA User";

  await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const loginResp = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const setCookie = loginResp.headers.get("set-cookie") || "";
  const tokenMatch = /([^=]+)=([^;]+)/.exec(setCookie);
  const token = tokenMatch?.[2];
  if (!token) {
    throw new Error("Login failed: token cookie missing.");
  }

  return token;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const qaUi = async () => {
  const { chromium } = await ensurePlaywright();
  const token = await registerAndLogin();
  const { ref: orderRef, productId } = await createOrder(token);
  await createReview(token, productId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies([
    { name: "token", value: token, domain: "localhost", path: "/" },
  ]);
  const page = await context.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("authSessionHint", "true");
  });

  await page.goto(
    `${APP_BASE}/checkout/success?ref=${encodeURIComponent(orderRef)}`,
    { waitUntil: "networkidle" }
  );

  const successBanner = page.locator("text=Thank You").first();
  assert((await successBanner.count()) === 1, "Success banner missing");

  const refLabel = page.locator("text=Order Reference").first();
  assert((await refLabel.count()) === 1, "Order reference label missing");
  const refText = page.locator(`text=${orderRef}`).first();
  assert((await refText.count()) === 1, "Order reference value missing");

  const viewInvoiceLink = page.getByRole("link", { name: "View Invoice" });
  const viewHref = await viewInvoiceLink.getAttribute("href");
  assert(viewHref === `/order/${orderRef}`, "View Invoice link mismatch");

  const myOrdersLink = page.getByRole("link", { name: "My Orders" });
  const myOrdersHref = await myOrdersLink.getAttribute("href");
  assert(myOrdersHref === "/account/orders", "My Orders link mismatch");

  await page.goto(`${APP_BASE}/account/my-review`, { waitUntil: "networkidle" });
  const needTab = page.getByRole("button", { name: "Need to Review" });
  assert((await needTab.count()) === 1, "Need to Review tab missing");
  const reviewedTab = page.getByRole("button", { name: "Reviewed Products" });
  assert((await reviewedTab.count()) === 1, "Reviewed Products tab missing");
  await reviewedTab.click();
  const editButton = page.getByRole("button", { name: "Edit Review" }).first();
  assert((await editButton.count()) === 1, "Edit Review button missing");

  await page.goto(`${APP_BASE}/account/orders`, { waitUntil: "networkidle" });

  const title = page.getByRole("heading", { name: "My Orders" });
  assert((await title.count()) === 1, "My Orders heading missing");
  const titleClass = await title.getAttribute("class");
  assert(titleClass?.includes("text-2xl"), "Title missing text-2xl");
  assert(titleClass?.includes("font-bold"), "Title missing font-bold");

  const tableHead = page.locator("table thead").first();
  const headClass = await tableHead.getAttribute("class");
  assert(headClass?.includes("bg-slate-50"), "Table head missing bg-slate-50");
  const headText = await tableHead.textContent();
  for (const label of REQUIRED_HEADERS) {
    assert(headText?.includes(label), `Header missing ${label}`);
  }

  const firstRow = page.locator("table tbody tr").first();
  const rowClass = await firstRow.getAttribute("class");
  assert(rowClass?.includes("hover:bg-slate-50"), "Row hover class missing");

  const orderIdCell = firstRow.locator("td").first();
  const orderIdClass = await orderIdCell.getAttribute("class");
  assert(orderIdClass?.includes("font-semibold"), "Order ID not bold");

  const statusCell = firstRow.locator("td").nth(3);
  const statusWrapper = statusCell.locator("span").first();
  const statusClass = await statusWrapper.getAttribute("class");
  assert(statusClass?.includes("flex"), "Status wrapper missing flex");
  assert(statusClass?.includes("items-center"), "Status wrapper missing items-center");

  const eyeLink = firstRow.locator("a[href^='/order/']").first();
  const eyeClass = await eyeLink.getAttribute("class");
  assert(eyeClass?.includes("h-9"), "Eye button missing h-9");
  assert(eyeClass?.includes("rounded-full"), "Eye button missing rounded-full");

  const prevButton = page.getByRole("button", { name: "Prev" });
  assert(await prevButton.isDisabled(), "Prev button should be disabled on page 1");

  await eyeLink.click();
  await page.waitForURL(/\/order\//);

  const banner = page.locator(".no-print").first();
  assert((await banner.textContent())?.includes("Thank You"), "Banner text missing");

  const invoiceTitle = page.getByRole("heading", { name: "INVOICE" });
  const invoiceTitleClass = await invoiceTitle.getAttribute("class");
  assert(invoiceTitleClass?.includes("text-3xl"), "Invoice title missing text-3xl");
  assert(invoiceTitleClass?.includes("font-extrabold"), "Invoice title missing font-extrabold");

  const invoiceHeader = page.locator(".print-area > div").first();
  const headerClass = await invoiceHeader.getAttribute("class");
  assert(headerClass?.includes("bg-slate-100/60"), "Invoice header missing bg-slate-100/60");

  const invoiceTo = invoiceHeader.locator("text=Invoice To").first().locator("..");
  const invoiceToClass = await invoiceTo.getAttribute("class");
  assert(invoiceToClass?.includes("md:text-right"), "Invoice To missing md:text-right");

  const itemsHead = page.locator(".print-area table thead").first();
  const itemsHeadText = await itemsHead.textContent();
  ["SR.", "PRODUCT NAME", "QUANTITY", "ITEM PRICE", "AMOUNT"].forEach((label) => {
    assert(itemsHeadText?.includes(label), `Items header missing ${label}`);
  });

  const summaryBar = page.locator(".print-area .bg-emerald-50").first();
  const summaryClass = await summaryBar.getAttribute("class");
  assert(summaryClass?.includes("bg-emerald-50"), "Summary bar missing bg-emerald-50");

  const totalAmount = page.locator("text=Total Amount").locator("..").locator("p").last();
  const totalClass = await totalAmount.getAttribute("class");
  assert(totalClass?.includes("text-4xl"), "Total amount missing text-4xl");
  assert(totalClass?.includes("text-red-500"), "Total amount missing text-red-500");

  const downloadBtn = page.getByRole("button", { name: "Download PDF" });
  const downloadClass = await downloadBtn.getAttribute("class");
  assert(downloadClass?.includes("bg-emerald-600"), "Download button missing bg-emerald-600");

  const printBtn = page.getByRole("button", { name: "Print Invoice" });
  const printClass = await printBtn.getAttribute("class");
  assert(printClass?.includes("bg-blue-600"), "Print button missing bg-blue-600");

  await page.emulateMedia({ media: "print" });
  const bannerDisplay = await banner.evaluate((el) => getComputedStyle(el).display);
  assert(bannerDisplay === "none", "Banner should be hidden in print mode");
  const buttonsDisplay = await page
    .locator(".no-print")
    .last()
    .evaluate((el) => getComputedStyle(el).display);
  assert(buttonsDisplay === "none", "Buttons should be hidden in print mode");

  await browser.close();
};

const stopProcessTree = (proc) =>
  new Promise((resolve) => {
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

const main = async () => {
  let proc = null;
  try {
    log("Starting dev servers...");
    proc = spawn("pnpm", ["-w", "dev"], { stdio: "inherit", shell: true });

    const apiReady = await withTimeout(() => waitFor(HEALTH_URL, 60000), 70000, "health");
    if (!apiReady) throw new Error("API health check failed.");

    const appReady = await withTimeout(() => waitFor(APP_BASE, 60000), 70000, "app");
    if (!appReady) throw new Error("App did not respond on /.");

    log("Running UI QA checks...");
    await qaUi();
    log("QA passed.");
  } catch (error) {
    exitWith(`QA failed: ${error?.message || error}`);
  } finally {
    log("Stopping dev servers...");
    await stopProcessTree(proc);
  }
};

main();
