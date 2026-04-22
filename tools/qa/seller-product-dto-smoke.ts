import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";
import { chromium } from "playwright";
import {
  mapSellerProductDetail,
  mapSellerProductListItem,
} from "../../client/src/api/productDto.ts";

loadEnv({ path: path.resolve(process.cwd(), "server/.env") });

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
  headers: Headers;
};

type StepResult = {
  id: string;
  title: string;
  status: "passed" | "failed";
  summary: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  proof?: Record<string, any>;
  rootCause?: string | null;
};

const SERVER_BASE_URL = String(process.env.SELLER_FLOW_BASE_URL || "http://localhost:3001").replace(
  /\/+$/,
  "",
);
const CLIENT_BASE_URL = String(process.env.SELLER_FLOW_CLIENT_URL || "http://localhost:5173").replace(
  /\/+$/,
  "",
);
const STORE_SLUG = String(process.env.SELLER_FLOW_STORE_SLUG || "super-admin-1").trim();
const SELLER_EMAIL = String(process.env.SELLER_FLOW_EMAIL || "superadmin@local.dev").trim();
const SELLER_PASSWORD = String(process.env.SELLER_FLOW_PASSWORD || "supersecure123").trim();
const RUN_STAMP = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "z");
const RUN_ID = `seller-dto-smoke-${RUN_STAMP}-${Math.random().toString(36).slice(2, 8)}`;
const REPORT_DIR = path.resolve(process.cwd(), "reports", RUN_ID);

const PRIMARY_IMAGE_FIXTURE = path.resolve(
  process.cwd(),
  "server",
  "uploads",
  "1770829603721-3ncw5zbc.jpg",
);
const SECONDARY_IMAGE_FIXTURE = path.resolve(
  process.cwd(),
  "reports",
  "slider-qa",
  "short.png",
);

const CREATE_NAME = `DTO Smoke ${RUN_ID}`;
const CREATE_DESCRIPTION = `Smoke validation create payload for ${RUN_ID}.`;
const CREATE_SKU = `DTO-${RUN_ID}`.slice(0, 60);
const CREATE_BARCODE = `BAR-${RUN_ID}`.slice(0, 60);
const CREATE_SLUG = `${RUN_ID}-draft`.toLowerCase();
const CREATE_PRICE = 125000;
const CREATE_SALE_PRICE = 99000;
const CREATE_STOCK = 8;
const CREATE_TAGS = ["dto-smoke", RUN_ID];

const UPDATE_NAME = `${CREATE_NAME} Edited`;
const UPDATE_DESCRIPTION = `Smoke validation update payload for ${RUN_ID}.`;
const UPDATE_SLUG = `${RUN_ID}-edited`.toLowerCase();
const UPDATE_PRICE = 149000;
const UPDATE_SALE_PRICE = 109000;
const UPDATE_STOCK = 5;
const UPDATE_TAG = "edited";

const report: {
  runId: string;
  startedAt: string;
  serverBaseUrl: string;
  clientBaseUrl: string;
  storeSlug: string;
  sellerEmail: string;
  storeId: number | null;
  category: { id: number | null; name: string | null };
  productId: number | null;
  productSlug: string | null;
  screenshots: string[];
  mismatches: string[];
  steps: StepResult[];
  overallStatus: "passed" | "failed";
  failure?: {
    stepId: string;
    stepTitle: string;
    message: string;
    rootCause?: string | null;
  };
} = {
  runId: RUN_ID,
  startedAt: new Date().toISOString(),
  serverBaseUrl: SERVER_BASE_URL,
  clientBaseUrl: CLIENT_BASE_URL,
  storeSlug: STORE_SLUG,
  sellerEmail: SELLER_EMAIL,
  storeId: null,
  category: { id: null, name: null },
  productId: null,
  productSlug: null,
  screenshots: [],
  mismatches: [],
  steps: [],
  overallStatus: "passed",
};

class HttpClient {
  cookie = "";

  async request(urlOrPath: string, init: RequestInit = {}): Promise<JsonResponse> {
    const absoluteUrl = /^https?:\/\//i.test(urlOrPath)
      ? urlOrPath
      : `${SERVER_BASE_URL}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (this.cookie) headers.set("Cookie", this.cookie);
    const hasBody = typeof init.body !== "undefined" && init.body !== null;
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (hasBody && !isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(absoluteUrl, { ...init, headers, redirect: "manual" });
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

    return { status: response.status, ok: response.ok, body, text, headers: response.headers };
  }
}

const log = (message: string, extra?: Record<string, any>) => {
  const line = extra ? `${message} ${JSON.stringify(extra)}` : message;
  console.log(`[seller-product-dto-smoke] ${line}`);
};

const ensure = (condition: unknown, message: string, rootCause?: string) => {
  if (!condition) {
    const error = new Error(message);
    (error as any).rootCause = rootCause || message;
    throw error;
  }
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sanitizeFileName = (value: string) =>
  String(value || "")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

const saveScreenshotPath = async (name: string) => {
  const filePath = path.resolve(REPORT_DIR, sanitizeFileName(name));
  report.screenshots.push(filePath);
  return filePath;
};

const writeArtifacts = async () => {
  const reportJsonPath = path.resolve(REPORT_DIR, "report.json");
  const reportMdPath = path.resolve(REPORT_DIR, "report.md");
  const lines = [
    "# Seller Product DTO Smoke Report",
    "",
    `- Run ID: \`${report.runId}\``,
    `- Started At: \`${report.startedAt}\``,
    `- Server Base URL: \`${report.serverBaseUrl}\``,
    `- Client Base URL: \`${report.clientBaseUrl}\``,
    `- Store Slug: \`${report.storeSlug}\``,
    `- Seller Email: \`${report.sellerEmail}\``,
    `- Store ID: \`${report.storeId ?? "-"}\``,
    `- Category: \`${report.category.name || "-"}\``,
    `- Product ID: \`${report.productId ?? "-"}\``,
    `- Product Slug: \`${report.productSlug ?? "-"}\``,
    `- Overall Status: \`${report.overallStatus}\``,
    "",
    "## Steps",
    "",
  ];

  report.steps.forEach((step) => {
    lines.push(`### ${step.id}. ${step.title}`);
    lines.push(`- Status: \`${step.status}\``);
    lines.push(`- Summary: ${step.summary}`);
    lines.push(`- Duration: \`${step.durationMs}ms\``);
    if (step.rootCause) lines.push(`- Root Cause: ${step.rootCause}`);
    if (step.proof && Object.keys(step.proof).length > 0) {
      lines.push("- Proof:");
      for (const [key, value] of Object.entries(step.proof)) {
        lines.push(`  - ${key}: \`${JSON.stringify(value)}\``);
      }
    }
    lines.push("");
  });

  lines.push("## Mismatches", "");
  if (report.mismatches.length === 0) {
    lines.push("- None");
  } else {
    report.mismatches.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");

  if (report.screenshots.length > 0) {
    lines.push("## Screenshots", "");
    report.screenshots.forEach((item) => lines.push(`- \`${item}\``));
    lines.push("");
  }

  if (report.failure) {
    lines.push("## Failure", "");
    lines.push(`- Step: \`${report.failure.stepId}. ${report.failure.stepTitle}\``);
    lines.push(`- Message: ${report.failure.message}`);
    if (report.failure.rootCause) lines.push(`- Root Cause: ${report.failure.rootCause}`);
    lines.push("");
  }

  await fs.mkdir(REPORT_DIR, { recursive: true });
  await fs.writeFile(reportJsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(reportMdPath, `${lines.join("\n").trim()}\n`, "utf8");
  return { reportJsonPath, reportMdPath };
};

const runStep = async (
  id: string,
  title: string,
  fn: () => Promise<{ summary: string; proof?: Record<string, any> }>,
) => {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  log(`STEP ${id} ${title} started`);
  try {
    const result = await fn();
    report.steps.push({
      id,
      title,
      status: "passed",
      summary: result.summary,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      proof: result.proof,
      rootCause: null,
    });
    log(`STEP ${id} ${title} passed`, result.proof);
    return result;
  } catch (error) {
    const rootCause =
      String((error as any)?.rootCause || (error as any)?.message || "Validation step failed.").trim() ||
      "Validation step failed.";
    report.steps.push({
      id,
      title,
      status: "failed",
      summary: String((error as any)?.message || "Validation step failed."),
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedMs,
      proof:
        typeof (error as any)?.lastValue !== "undefined"
          ? { lastValue: (error as any).lastValue }
          : undefined,
      rootCause,
    });
    report.overallStatus = "failed";
    report.failure = {
      stepId: id,
      stepTitle: title,
      message: String((error as any)?.message || "Validation step failed."),
      rootCause,
    };
    log(`STEP ${id} ${title} failed`, { message: report.failure.message, rootCause });
    throw error;
  }
};

const waitForHttpOk = async (url: string, label: string, timeoutMs = 30000) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt <= timeoutMs) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      if (response.ok || response.status === 304) return;
    } catch {
      // retry
    }
    await sleep(1000);
  }
  throw new Error(`${label} is not reachable at ${url}.`);
};

const parseCookie = (cookie: string) => {
  const [name = "", ...rest] = String(cookie || "").split("=");
  return {
    name: name.trim(),
    value: rest.join("=").trim(),
  };
};

const normalizePayload = (payload: any) => JSON.parse(JSON.stringify(payload));

const expectNoForbiddenWriteFields = (payload: Record<string, any>, label: string) => {
  ["status", "published", "seo", "variations"].forEach((field) => {
    if (field in payload) {
      report.mismatches.push(`${label} unexpectedly included forbidden field "${field}".`);
    }
  });
};

const ensurePayloadKeys = (
  payload: Record<string, any>,
  expectedKeys: string[],
  label: string,
) => {
  const actualKeys = Object.keys(payload).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expected)) {
    report.mismatches.push(
      `${label} keys mismatch. expected=${expected.join(",")} actual=${actualKeys.join(",")}`,
    );
  }
};

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });

  await waitForHttpOk(`${SERVER_BASE_URL}/api/auth/health`, "Server auth health");
  await waitForHttpOk(CLIENT_BASE_URL, "Client dev server");
  ensure(
    await fs.stat(PRIMARY_IMAGE_FIXTURE).then(() => true).catch(() => false),
    `Primary fixture missing: ${PRIMARY_IMAGE_FIXTURE}`,
  );
  ensure(
    await fs.stat(SECONDARY_IMAGE_FIXTURE).then(() => true).catch(() => false),
    `Secondary fixture missing: ${SECONDARY_IMAGE_FIXTURE}`,
  );

  const client = new HttpClient();
  let storeId = 0;
  let categoryId = 0;
  let categoryName = "";
  let productId = 0;
  let productSlug = CREATE_SLUG;
  let createPayload: Record<string, any> | null = null;
  let updatePayload: Record<string, any> | null = null;
  let primaryImageUrl = "";
  let secondaryImageUrl = "";

  await runStep("1", "Bootstrap seller session and references", async () => {
    let loginResponse: JsonResponse | null = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      loginResponse = await client.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: SELLER_EMAIL, password: SELLER_PASSWORD }),
      });
      if (loginResponse.status !== 429) break;
      const retryAfterSeconds = Math.max(
        1,
        Number(loginResponse.body?.data?.retryAfterSeconds || 5),
      );
      log("seller login rate limited", { attempt, retryAfterSeconds });
      await sleep((retryAfterSeconds + 1) * 1000);
    }
    ensure(
      loginResponse && loginResponse.status === 200 && loginResponse.body?.success === true && client.cookie,
      "Seller login failed before smoke validation.",
      loginResponse?.body?.message || "Unable to establish seller session.",
    );

    const contextResponse = await client.request(
      `/api/seller/stores/slug/${encodeURIComponent(STORE_SLUG)}/context`,
    );
    ensure(
      contextResponse.status === 200 && contextResponse.body?.success === true,
      "Seller store context failed to load.",
      contextResponse.body?.message || "Seller account does not have access to the target store.",
    );

    const contextData = contextResponse.body?.data || {};
    storeId = Number(contextData?.store?.id || 0);
    ensure(storeId > 0, "Seller store context did not return a valid store id.");
    report.storeId = storeId;

    const metaResponse = await client.request(`/api/seller/stores/${storeId}/products/authoring/meta`);
    ensure(
      metaResponse.status === 200 && metaResponse.body?.success === true,
      "Seller authoring metadata failed to load.",
      metaResponse.body?.message || "Authoring metadata endpoint is unavailable.",
    );

    const category =
      (Array.isArray(metaResponse.body?.data?.references?.categories)
        ? metaResponse.body.data.references.categories.find((entry: any) => Number(entry?.id) > 0)
        : null) || null;
    ensure(category, "Seller authoring metadata returned no usable category.");
    categoryId = Number(category.id);
    categoryName = String(category.name || category.code || category.id);
    report.category = { id: categoryId, name: categoryName };

    return {
      summary: "Seller session, store context, and category references are ready.",
      proof: {
        storeId,
        categoryId,
        categoryName,
        cookieName: parseCookie(client.cookie).name,
      },
    };
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  const cookie = parseCookie(client.cookie);
  await context.addCookies([
    {
      name: cookie.name,
      value: cookie.value,
      url: CLIENT_BASE_URL,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  await context.addInitScript(() => {
    localStorage.setItem("authSessionHint", "true");
  });
  const page = await context.newPage();

  try {
    await runStep("2", "Create seller product through UI and capture payload", async () => {
      await page.goto(`${CLIENT_BASE_URL}/seller/stores/${encodeURIComponent(STORE_SLUG)}/catalog/products/new`, {
        waitUntil: "domcontentloaded",
      });
      await page.getByRole("heading", { name: "Add Product" }).waitFor({ timeout: 30000 });

      await page.getByLabel("Name").fill(CREATE_NAME);
      await page.getByLabel("Description").fill(CREATE_DESCRIPTION);
      await page.getByLabel("SKU").fill(CREATE_SKU);
      await page.getByLabel("Barcode").fill(CREATE_BARCODE);
      await page.getByLabel("Slug").fill(CREATE_SLUG);
      await page.getByLabel(categoryName).check();
      await page.getByLabel("Default Category").selectOption(String(categoryId));
      await page.getByRole("spinbutton", { name: "Base Price", exact: true }).fill(String(CREATE_PRICE));
      await page.getByRole("spinbutton", { name: /Sale Price/i }).fill(String(CREATE_SALE_PRICE));
      await page.getByRole("spinbutton", { name: "Stock", exact: true }).fill(String(CREATE_STOCK));

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([PRIMARY_IMAGE_FIXTURE, SECONDARY_IMAGE_FIXTURE]);
      await page.getByText("2 image(s)", { exact: false }).waitFor({ timeout: 30000 });

      const tagInput = page.getByPlaceholder("Add tag");
      for (const tag of CREATE_TAGS) {
        await tagInput.fill(tag);
        await tagInput.press("Enter");
      }

      const createRequestPromise = page.waitForRequest((request) =>
        request.method() === "POST" &&
        /\/api\/seller\/stores\/\d+\/products\/drafts$/.test(new URL(request.url()).pathname),
      );
      const createResponsePromise = page.waitForResponse((response) =>
        response.request().method() === "POST" &&
        /\/api\/seller\/stores\/\d+\/products\/drafts$/.test(new URL(response.url()).pathname),
      );

      await page.getByRole("button", { name: "Save Draft" }).click();

      const [createRequest, createResponse] = await Promise.all([
        createRequestPromise,
        createResponsePromise,
      ]);
      ensure(createResponse.status() === 200 || createResponse.status() === 201, "Create draft response failed.");

      createPayload = normalizePayload(createRequest.postDataJSON() || {});
      const createBody = await createResponse.json();
      productId = Number(createBody?.data?.id || 0);
      productSlug = String(createBody?.data?.slug || CREATE_SLUG);
      report.productId = productId;
      report.productSlug = productSlug;

      ensure(productId > 0, "Create draft did not return a valid product id.");

      ensurePayloadKeys(
        createPayload,
        [
          "barcode",
          "categoryIds",
          "defaultCategoryId",
          "description",
          "imageUrls",
          "name",
          "price",
          "salePrice",
          "sku",
          "slug",
          "stock",
          "tags",
        ],
        "Create payload",
      );
      expectNoForbiddenWriteFields(createPayload, "Create payload");

      ensure(createPayload.name === CREATE_NAME, "Create payload name mismatch.");
      ensure(createPayload.slug === CREATE_SLUG, "Create payload slug mismatch.");
      ensure(Number(createPayload.price) === CREATE_PRICE, "Create payload base price mismatch.");
      ensure(Number(createPayload.salePrice) === CREATE_SALE_PRICE, "Create payload sale price mismatch.");
      ensure(Number(createPayload.stock) === CREATE_STOCK, "Create payload stock mismatch.");
      ensure(
        Array.isArray(createPayload.categoryIds) && createPayload.categoryIds.includes(categoryId),
        "Create payload categoryIds missing selected category.",
      );
      ensure(Number(createPayload.defaultCategoryId) === categoryId, "Create payload defaultCategoryId mismatch.");
      ensure(Array.isArray(createPayload.imageUrls) && createPayload.imageUrls.length === 2, "Create payload imageUrls mismatch.");
      ensure(Array.isArray(createPayload.tags) && createPayload.tags.length === CREATE_TAGS.length, "Create payload tags mismatch.");

      [primaryImageUrl, secondaryImageUrl] = createPayload.imageUrls;
      ensure(Boolean(primaryImageUrl) && Boolean(secondaryImageUrl), "Create payload image URLs are empty.");

      await page.waitForURL(new RegExp(`/seller/stores/${STORE_SLUG}/catalog/products/${productId}/edit`), {
        timeout: 30000,
      });
      const screenshot = await saveScreenshotPath("02-create-edit-page.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      return {
        summary: "Create flow succeeded through Seller UI and emitted the expected adapter payload.",
        proof: {
          productId,
          productSlug,
          createPayload,
          screenshot,
        },
      };
    });

    await runStep("3", "Update seller product through UI and capture payload", async () => {
      await page.getByLabel("Name").fill(UPDATE_NAME);
      await page.getByLabel("Description").fill(UPDATE_DESCRIPTION);
      await page.getByLabel("Slug").fill(UPDATE_SLUG);
      await page.getByRole("spinbutton", { name: "Base Price", exact: true }).fill(String(UPDATE_PRICE));
      await page.getByRole("spinbutton", { name: /Sale Price/i }).fill(String(UPDATE_SALE_PRICE));
      await page.getByRole("spinbutton", { name: "Stock", exact: true }).fill(String(UPDATE_STOCK));

      const tagInput = page.getByPlaceholder("Add tag");
      await tagInput.fill(UPDATE_TAG);
      await tagInput.press("Enter");

      const setPrimaryButton = page.getByRole("button", { name: "Set as Primary" }).first();
      await setPrimaryButton.click();

      const updateRequestPromise = page.waitForRequest((request) =>
        request.method() === "PATCH" &&
        new RegExp(`/api/seller/stores/\\d+/products/${productId}/draft$`).test(
          new URL(request.url()).pathname,
        ),
      );
      const updateResponsePromise = page.waitForResponse((response) =>
        response.request().method() === "PATCH" &&
        new RegExp(`/api/seller/stores/\\d+/products/${productId}/draft$`).test(
          new URL(response.url()).pathname,
        ),
      );

      await page.getByRole("button", { name: "Save" }).click();

      const [updateRequest, updateResponse] = await Promise.all([
        updateRequestPromise,
        updateResponsePromise,
      ]);
      ensure(updateResponse.status() === 200, "Update draft response failed.");

      updatePayload = normalizePayload(updateRequest.postDataJSON() || {});
      const updateBody = await updateResponse.json();
      productSlug = String(updateBody?.data?.slug || UPDATE_SLUG);
      report.productSlug = productSlug;

      ensurePayloadKeys(
        updatePayload,
        [
          "barcode",
          "categoryIds",
          "defaultCategoryId",
          "description",
          "imageUrls",
          "name",
          "price",
          "salePrice",
          "sku",
          "slug",
          "stock",
          "tags",
        ],
        "Update payload",
      );
      expectNoForbiddenWriteFields(updatePayload, "Update payload");

      ensure(updatePayload.name === UPDATE_NAME, "Update payload name mismatch.");
      ensure(updatePayload.slug === UPDATE_SLUG, "Update payload slug mismatch.");
      ensure(Number(updatePayload.price) === UPDATE_PRICE, "Update payload base price mismatch.");
      ensure(Number(updatePayload.salePrice) === UPDATE_SALE_PRICE, "Update payload sale price mismatch.");
      ensure(Number(updatePayload.stock) === UPDATE_STOCK, "Update payload stock mismatch.");
      ensure(
        Array.isArray(updatePayload.imageUrls) &&
          updatePayload.imageUrls[0] === secondaryImageUrl &&
          updatePayload.imageUrls[1] === primaryImageUrl,
        "Update payload did not persist primary image reorder.",
      );
      ensure(
        Array.isArray(updatePayload.tags) && updatePayload.tags.includes(UPDATE_TAG),
        "Update payload tag set mismatch.",
      );

      const screenshot = await saveScreenshotPath("03-updated-edit-page.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      return {
        summary: "Update flow succeeded through Seller UI and preserved reordered media plus edited fields.",
        proof: {
          updatePayload,
          screenshot,
        },
      };
    });

    let mappedListItem: any = null;
    let mappedDetail: any = null;

    await runStep("4", "Validate mapped Seller list and detail DTO", async () => {
      const listResponse = await client.request(
        `/api/seller/stores/${storeId}/products?keyword=${encodeURIComponent(RUN_ID)}&page=1&limit=20`,
      );
      ensure(
        listResponse.status === 200 && listResponse.body?.success === true,
        "Seller list API failed during DTO smoke.",
      );
      const rawListItems = Array.isArray(listResponse.body?.data?.items)
        ? listResponse.body.data.items
        : [];
      const rawListItem = rawListItems.find((entry: any) => Number(entry?.id) === productId) || null;
      ensure(rawListItem, "Created product is missing from seller list response.");
      mappedListItem = mapSellerProductListItem(rawListItem);

      const detailResponse = await client.request(`/api/seller/stores/${storeId}/products/${productId}`);
      ensure(
        detailResponse.status === 200 && detailResponse.body?.success === true,
        "Seller detail API failed during DTO smoke.",
      );
      mappedDetail = mapSellerProductDetail(detailResponse.body?.data ?? null);

      ensure(mappedListItem?.name === UPDATE_NAME, "Mapped list DTO dropped updated name.");
      ensure(mappedListItem?.slug === UPDATE_SLUG, "Mapped list DTO dropped updated slug.");
      ensure(mappedListItem?.status === "draft", "Mapped list DTO status mismatch.");
      ensure(mappedListItem?.published === false, "Mapped list DTO published flag mismatch.");
      ensure(mappedListItem?.category?.name === categoryName, "Mapped list DTO category mismatch.");
      ensure(Number(mappedListItem?.pricing?.price) === UPDATE_PRICE, "Mapped list DTO base price mismatch.");
      ensure(Number(mappedListItem?.pricing?.salePrice) === UPDATE_SALE_PRICE, "Mapped list DTO sale price mismatch.");
      ensure(Number(mappedListItem?.inventory?.stock) === UPDATE_STOCK, "Mapped list DTO stock mismatch.");
      ensure(
        String(mappedListItem?.mediaPreviewUrl || "") === secondaryImageUrl,
        "Mapped list DTO primary image mismatch.",
      );

      ensure(mappedDetail?.name === UPDATE_NAME, "Mapped detail DTO dropped updated name.");
      ensure(mappedDetail?.slug === UPDATE_SLUG, "Mapped detail DTO dropped updated slug.");
      ensure(
        mappedDetail?.descriptions?.description === UPDATE_DESCRIPTION,
        "Mapped detail DTO description mismatch.",
      );
      ensure(
        Array.isArray(mappedDetail?.media?.imageUrls) &&
          mappedDetail.media.imageUrls[0] === secondaryImageUrl,
        "Mapped detail DTO primary image mismatch.",
      );
      ensure(
        mappedDetail?.category?.default?.id === categoryId,
        "Mapped detail DTO default category mismatch.",
      );
      ensure(
        Array.isArray(mappedDetail?.category?.assigned) &&
          mappedDetail.category.assigned.some((entry: any) => Number(entry?.id) === categoryId),
        "Mapped detail DTO assigned categories mismatch.",
      );
      if (
        !(
          Array.isArray(mappedDetail?.attributes?.tags) &&
          mappedDetail.attributes.tags.includes(UPDATE_TAG)
        )
      ) {
        report.mismatches.push(
          `Mapped detail DTO tags dropped "${UPDATE_TAG}". mappedTags=${JSON.stringify(
            mappedDetail?.attributes?.tags || [],
          )}`,
        );
      }
      ensure(Number(mappedDetail?.pricing?.price) === UPDATE_PRICE, "Mapped detail DTO base price mismatch.");
      ensure(Number(mappedDetail?.inventory?.stock) === UPDATE_STOCK, "Mapped detail DTO stock mismatch.");
      ensure(Boolean(mappedDetail?.visibility), "Mapped detail DTO visibility dropped.");
      ensure(Boolean(mappedDetail?.submission), "Mapped detail DTO submission dropped.");

      return {
        summary: "Shared seller DTO adapter preserved list and detail fields after create/update.",
        proof: {
          mappedListItem: {
            id: mappedListItem.id,
            name: mappedListItem.name,
            slug: mappedListItem.slug,
            status: mappedListItem.status,
            published: mappedListItem.published,
            category: mappedListItem.category?.name,
            price: mappedListItem.pricing?.price,
            salePrice: mappedListItem.pricing?.salePrice,
            stock: mappedListItem.inventory?.stock,
            mediaPreviewUrl: mappedListItem.mediaPreviewUrl,
          },
          mappedDetail: {
            id: mappedDetail.id,
            description: mappedDetail.descriptions?.description,
            defaultCategory: mappedDetail.category?.default?.name,
            assignedCategories: Array.isArray(mappedDetail.category?.assigned)
              ? mappedDetail.category.assigned.map((entry: any) => entry?.name)
              : [],
            tags: mappedDetail.attributes?.tags,
            visibilityState: mappedDetail.visibility?.stateCode,
            submissionStatus: mappedDetail.submission?.status,
          },
        },
      };
    });

    await runStep("5", "Validate Seller list UI", async () => {
      await page.goto(`${CLIENT_BASE_URL}/seller/stores/${encodeURIComponent(STORE_SLUG)}/catalog/products`, {
        waitUntil: "domcontentloaded",
      });
      await page.getByPlaceholder("Search name, slug, or SKU").fill(RUN_ID);
      await page.getByPlaceholder("Search name, slug, or SKU").press("Enter");
      const row = page.getByRole("row").filter({ hasText: UPDATE_NAME }).first();
      await row.waitFor({ timeout: 30000 });

      await row.getByRole("link", { name: UPDATE_NAME }).waitFor({ timeout: 10000 });
      ensure(await row.getByText(UPDATE_SLUG).isVisible(), "List UI slug is not visible.");
      ensure(await row.getByText("Draft").first().isVisible(), "List UI status badge is not visible.");
      ensure(await row.getByText("Unpublished").first().isVisible(), "List UI published badge is not visible.");
      ensure(await row.getByText(categoryName).first().isVisible(), "List UI category is not visible.");
      ensure(await row.getByText(/149\.000/).first().isVisible(), "List UI base price is not visible.");
      ensure(await row.getByText(/109\.000/).first().isVisible(), "List UI sale price is not visible.");
      ensure(await row.getByText(String(UPDATE_STOCK)).first().isVisible(), "List UI stock is not visible.");

      const imageSrc = await row.locator("img").first().getAttribute("src");
      ensure(
        String(imageSrc || "").includes(path.basename(secondaryImageUrl)),
        "List UI primary image src does not match reordered primary image.",
      );

      const screenshot = await saveScreenshotPath("05-seller-list.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      return {
        summary: "Seller list still renders key product fields correctly after DTO adapter rollout.",
        proof: {
          rowImageSrc: imageSrc,
          screenshot,
        },
      };
    });

    await runStep("6", "Validate Seller detail UI", async () => {
      await page.goto(
        `${CLIENT_BASE_URL}/seller/stores/${encodeURIComponent(STORE_SLUG)}/catalog/products/${productId}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.getByText(UPDATE_NAME, { exact: false }).first().waitFor({ timeout: 30000 });

      const screenshot = await saveScreenshotPath("06-seller-detail.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      ensure(await page.getByText(UPDATE_DESCRIPTION, { exact: false }).isVisible(), "Detail UI description is not visible.");
      ensure(await page.getByText(UPDATE_SLUG).first().isVisible(), "Detail UI slug is not visible.");
      ensure(await page.getByText(categoryName).first().isVisible(), "Detail UI category is not visible.");
      ensure(await page.getByText(/149\.000/).first().isVisible(), "Detail UI base price is not visible.");
      ensure(await page.getByText(/109\.000/).first().isVisible(), "Detail UI sale price is not visible.");
      ensure(await page.getByText(String(UPDATE_STOCK)).first().isVisible(), "Detail UI stock is not visible.");
      ensure(await page.getByText("Not submitted").first().isVisible(), "Detail UI submission badge is not visible.");
      ensure(await page.getByText("Unpublished").first().isVisible(), "Detail UI visibility/publish badge is not visible.");
      ensure(
        !(await page.getByText("No tag data stored.").first().isVisible()),
        "Detail UI tags dropped after update.",
      );
      ensure(await page.getByText(UPDATE_TAG, { exact: true }).first().isVisible(), "Detail UI edited tag is not visible.");

      const firstImageSrc = await page.locator(`img[alt="${UPDATE_NAME}"]`).first().getAttribute("src");
      ensure(
        String(firstImageSrc || "").includes(path.basename(secondaryImageUrl)),
        "Detail UI primary image src does not match reordered primary image.",
      );

      return {
        summary: "Seller detail still renders description, media, category, tags, pricing, and badges correctly.",
        proof: {
          firstImageSrc,
          screenshot,
        },
      };
    });
  } finally {
    await context.close();
    await browser.close();
  }
}

main()
  .then(async () => {
    const artifactPaths = await writeArtifacts();
    log("completed", artifactPaths);
  })
  .catch(async (error) => {
    report.overallStatus = "failed";
    console.error("[seller-product-dto-smoke] FAILED", error);
    try {
      const artifactPaths = await writeArtifacts();
      log("artifacts written after failure", artifactPaths);
    } catch (artifactError) {
      console.error("[seller-product-dto-smoke] failed to write artifacts", artifactError);
    }
    process.exitCode = 1;
  });
