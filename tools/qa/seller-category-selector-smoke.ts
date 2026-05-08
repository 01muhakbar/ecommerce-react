import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";
import { chromium } from "playwright";

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

type CategoryReference = {
  id: number;
  name: string;
  code: string | null;
  parentId: number | null;
};

const SERVER_BASE_URL = String(
  process.env.SELLER_FLOW_BASE_URL || "http://localhost:3001",
).replace(/\/+$/, "");
const CLIENT_BASE_URL = String(
  process.env.SELLER_FLOW_CLIENT_URL || "http://localhost:5173",
).replace(/\/+$/, "");
const STORE_SLUG = String(
  process.env.SELLER_FLOW_STORE_SLUG || "superseller-demo-store",
).trim();
const SELLER_EMAIL = String(
  process.env.SELLER_FLOW_EMAIL || "superseller@local.dev",
).trim();
const SELLER_PASSWORD = String(
  process.env.SELLER_FLOW_PASSWORD || "supersecure123",
).trim();
const RUN_STAMP = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "z");
const RUN_ID = `seller-category-selector-smoke-${RUN_STAMP}-${Math.random()
  .toString(36)
  .slice(2, 8)}`;
const REPORT_DIR = path.resolve(process.cwd(), "reports", RUN_ID);

const CREATE_NAME = `Category Selector ${RUN_ID}`;
const CREATE_DESCRIPTION = `Seller category selector smoke ${RUN_ID}.`;
const CREATE_SKU = `CATSEL-${RUN_ID}`.slice(0, 80);
const CREATE_SLUG = `${RUN_ID}-draft`.toLowerCase();
const CREATE_PRICE = 170000;
const CREATE_STOCK = 9;

const report: {
  runId: string;
  startedAt: string;
  serverBaseUrl: string;
  clientBaseUrl: string;
  storeSlug: string;
  sellerEmail: string;
  storeId: number | null;
  productId: number | null;
  productSlug: string | null;
  categories: {
    selected: Array<{ id: number; name: string; code: string | null }>;
    searchQuery: string | null;
  };
  screenshots: string[];
  regressions: string[];
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
  productId: null,
  productSlug: null,
  categories: {
    selected: [],
    searchQuery: null,
  },
  screenshots: [],
  regressions: [],
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
  console.log(`[seller-category-selector-smoke] ${line}`);
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

const escapeRegExp = (value: string) =>
  String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const saveScreenshotPath = async (name: string) => {
  const filePath = path.resolve(REPORT_DIR, sanitizeFileName(name));
  report.screenshots.push(filePath);
  return filePath;
};

const writeArtifacts = async () => {
  const reportJsonPath = path.resolve(REPORT_DIR, "report.json");
  const reportMdPath = path.resolve(REPORT_DIR, "report.md");
  const lines = [
    "# Seller Category Selector Smoke Report",
    "",
    `- Run ID: \`${report.runId}\``,
    `- Started At: \`${report.startedAt}\``,
    `- Store Slug: \`${report.storeSlug}\``,
    `- Seller Email: \`${report.sellerEmail}\``,
    `- Store ID: \`${report.storeId ?? "-"}\``,
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

  lines.push("## Regressions", "");
  if (report.regressions.length === 0) {
    lines.push("- None");
  } else {
    report.regressions.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("");

  if (report.screenshots.length > 0) {
    lines.push("## Screenshots", "");
    report.screenshots.forEach((item) => lines.push(`- \`${item}\``));
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

const chooseCategories = (categories: CategoryReference[]) => {
  const usable = categories.filter((entry) => Number(entry?.id) > 0 && String(entry?.name || "").trim());
  ensure(usable.length >= 2, "Seller authoring metadata returned fewer than two usable categories.");

  const first = usable[0]!;
  const second =
    usable.find((entry) => Number(entry.id) !== Number(first.id) && entry.name !== first.name) ||
    usable[1]!;

  const searchQuery = String(second.code || second.name).trim();
  ensure(searchQuery.length >= 2, "Unable to derive a usable category search query.");

  return {
    first,
    second,
    searchQuery,
  };
};

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await waitForHttpOk(`${SERVER_BASE_URL}/api/auth/health`, "Server auth health");
  await waitForHttpOk(CLIENT_BASE_URL, "Client dev server");

  const client = new HttpClient();
  let storeId = 0;
  let productId = 0;
  let productSlug = CREATE_SLUG;
  let createPayload: Record<string, any> | null = null;
  let updatePayload: Record<string, any> | null = null;
  let firstCategory: CategoryReference | null = null;
  let secondCategory: CategoryReference | null = null;
  let searchQuery = "";

  await runStep("1", "Bootstrap seller session and category references", async () => {
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
      await sleep((retryAfterSeconds + 1) * 1000);
    }

    ensure(
      loginResponse &&
        loginResponse.status === 200 &&
        loginResponse.body?.success === true &&
        client.cookie,
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

    storeId = Number(contextResponse.body?.data?.store?.id || 0);
    ensure(storeId > 0, "Seller store context did not return a valid store id.");
    report.storeId = storeId;

    const metaResponse = await client.request(
      `/api/seller/stores/${storeId}/products/authoring/meta`,
    );
    ensure(
      metaResponse.status === 200 && metaResponse.body?.success === true,
      "Seller authoring metadata failed to load.",
      metaResponse.body?.message || "Authoring metadata endpoint is unavailable.",
    );

    const categories = Array.isArray(metaResponse.body?.data?.references?.categories)
      ? metaResponse.body.data.references.categories.map((entry: any) => ({
          id: Number(entry?.id || 0),
          name: String(entry?.name || "").trim(),
          code: String(entry?.code || "").trim() || null,
          parentId:
            entry?.parentId == null || entry?.parentId === ""
              ? null
              : Number(entry.parentId),
        }))
      : [];

    const chosen = chooseCategories(categories);
    firstCategory = chosen.first;
    secondCategory = chosen.second;
    searchQuery = chosen.searchQuery;
    report.categories.selected = [
      {
        id: firstCategory.id,
        name: firstCategory.name,
        code: firstCategory.code,
      },
      {
        id: secondCategory.id,
        name: secondCategory.name,
        code: secondCategory.code,
      },
    ];
    report.categories.searchQuery = searchQuery;

    return {
      summary: "Seller session and category references are ready.",
      proof: {
        storeId,
        selectedCategories: report.categories.selected,
        searchQuery,
        cookieName: parseCookie(client.cookie).name,
      },
    };
  });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
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

  const categoryCheckbox = (categoryName: string) =>
    page.getByRole("checkbox", {
      name: new RegExp(`^${escapeRegExp(categoryName)}(?:\\s|$)`, "i"),
    });
  const defaultCategorySelect = () => page.getByRole("combobox").first();

  try {
    await runStep("2", "Open Seller Product create page", async () => {
      await page.goto(
        `${CLIENT_BASE_URL}/seller/stores/${encodeURIComponent(STORE_SLUG)}/catalog/products/new`,
        { waitUntil: "domcontentloaded" },
      );
      await page.getByRole("heading", { name: "Add Product" }).waitFor({ timeout: 30000 });
      await page.getByPlaceholder("Search category name or code").waitFor({ timeout: 10000 });

      return {
        summary: "Seller product create page loaded with the new category selector.",
        proof: {
          url: page.url(),
        },
      };
    });

    await runStep("3", "Search category using the new search box", async () => {
      ensure(Boolean(secondCategory), "Search validation is missing the second category reference.");
      await page.getByPlaceholder("Search category name or code").fill(searchQuery);
      await categoryCheckbox(secondCategory!.name).waitFor({ timeout: 10000 });

      const screenshot = await saveScreenshotPath("01-search-category.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      return {
        summary: "Search narrowed the selector to the expected category entry.",
        proof: {
          searchQuery,
          matchedCategory: secondCategory!.name,
          screenshot,
        },
      };
    });

    await runStep("4", "Select multiple categories and set one as default", async () => {
      ensure(Boolean(firstCategory) && Boolean(secondCategory), "Selected categories are not available.");

      await page.getByPlaceholder("Search category name or code").fill("");
      await categoryCheckbox(firstCategory!.name).check();
      await categoryCheckbox(secondCategory!.name).check();

      await defaultCategorySelect().selectOption(String(secondCategory!.id));
      await page.getByText(`Default category: ${secondCategory!.name}`, { exact: false }).first().waitFor({
        timeout: 10000,
      });
      await page
        .getByText(`${secondCategory!.name} • Default`, { exact: false })
        .first()
        .waitFor({ timeout: 10000 });

      return {
        summary: "Multiple categories were selected and one default category was set.",
        proof: {
          selectedCategoryIds: [firstCategory!.id, secondCategory!.id],
          defaultCategoryId: secondCategory!.id,
        },
      };
    });

    await runStep("5", "Save draft and capture create payload", async () => {
      ensure(Boolean(firstCategory) && Boolean(secondCategory), "Selected categories are not available.");

      await page.getByLabel("Name").fill(CREATE_NAME);
      await page.getByLabel("Description").fill(CREATE_DESCRIPTION);
      await page.getByLabel("SKU").fill(CREATE_SKU);
      await page.getByLabel("Slug").fill(CREATE_SLUG);
      await page
        .getByRole("spinbutton", { name: "Base Price", exact: true })
        .fill(String(CREATE_PRICE));
      await page
        .getByRole("spinbutton", { name: "Stock", exact: true })
        .fill(String(CREATE_STOCK));

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

      ensure(
        createResponse.status() === 200 || createResponse.status() === 201,
        "Create draft response failed.",
      );

      createPayload = normalizePayload(createRequest.postDataJSON() || {});
      const createBody = await createResponse.json();
      productId = Number(createBody?.data?.id || 0);
      productSlug = String(createBody?.data?.slug || CREATE_SLUG);
      report.productId = productId;
      report.productSlug = productSlug;

      ensure(productId > 0, "Create draft did not return a valid product id.");
      ensure(
        Array.isArray(createPayload.categoryIds) &&
          createPayload.categoryIds.includes(firstCategory!.id) &&
          createPayload.categoryIds.includes(secondCategory!.id),
        "Create payload categoryIds are missing selected categories.",
      );
      ensure(
        Number(createPayload.defaultCategoryId) === secondCategory!.id,
        "Create payload defaultCategoryId mismatch.",
      );

      return {
        summary: "Draft saved with the expected selected categories and default category.",
        proof: {
          productId,
          productSlug,
          createPayload,
        },
      };
    });

    await runStep("6", "Re-open draft and verify category persistence", async () => {
      ensure(Boolean(productId), "Draft product id is missing.");
      ensure(Boolean(secondCategory), "Second category is missing.");

      await page.waitForURL(
        new RegExp(`/seller/stores/${STORE_SLUG}/catalog/products/${productId}/edit`),
        { timeout: 30000 },
      );
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Edit Product" }).waitFor({ timeout: 30000 });
      await page.getByText(`Default category: ${secondCategory!.name}`, { exact: false }).first().waitFor({
        timeout: 10000,
      });

      const defaultSelectValue = await defaultCategorySelect().inputValue();
      ensure(
        defaultSelectValue === String(secondCategory!.id),
        "Default category did not persist after reopening the draft.",
      );

      ensure(
        await categoryCheckbox(firstCategory!.name).isChecked(),
        "First selected category did not persist after reopening the draft.",
      );
      ensure(
        await categoryCheckbox(secondCategory!.name).isChecked(),
        "Second selected category did not persist after reopening the draft.",
      );
      ensure(
        await page
          .getByText(`${secondCategory!.name} • Default`, { exact: false })
          .first()
          .isVisible(),
        "Default badge is not visible on the reopened category selector.",
      );

      const screenshot = await saveScreenshotPath("02-reopened-draft.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      return {
        summary: "Selected categories, default category, and badges persisted after reopening the draft.",
        proof: {
          defaultSelectValue,
          screenshot,
        },
      };
    });

    await runStep("7", "Remove the default category and verify safe fallback", async () => {
      ensure(Boolean(firstCategory) && Boolean(secondCategory), "Selected categories are not available.");
      ensure(Boolean(productId), "Draft product id is missing.");

      await categoryCheckbox(secondCategory!.name).uncheck();

      const fallbackValue = await defaultCategorySelect().inputValue();
      ensure(
        fallbackValue === String(firstCategory!.id),
        "Default category did not re-normalize to the remaining category after removal.",
      );
      await page.getByText(`Default category: ${firstCategory!.name}`, { exact: false }).first().waitFor({
        timeout: 10000,
      });

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
      ensure(
        Array.isArray(updatePayload.categoryIds) &&
          updatePayload.categoryIds.length === 1 &&
          Number(updatePayload.categoryIds[0]) === firstCategory!.id,
        "Update payload categoryIds did not collapse to the remaining category.",
      );
      ensure(
        Number(updatePayload.defaultCategoryId) === firstCategory!.id,
        "Update payload defaultCategoryId did not follow the safe fallback.",
      );

      return {
        summary: "Removing the default category safely re-normalized the fallback before save.",
        proof: {
          fallbackValue,
          updatePayload,
        },
      };
    });

    await runStep("8", "Verify final product detail remains valid", async () => {
      ensure(Boolean(productId), "Draft product id is missing.");
      ensure(Boolean(firstCategory), "First category is missing.");

      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByRole("heading", { name: "Edit Product" }).waitFor({ timeout: 30000 });

      const detailResponse = await client.request(`/api/seller/stores/${storeId}/products/${productId}`);
      ensure(
        detailResponse.status === 200 && detailResponse.body?.success === true,
        "Seller detail API failed after category selector update.",
      );

      const detailData = detailResponse.body?.data || {};
      const assignedCategories = Array.isArray(detailData?.category?.assigned)
        ? detailData.category.assigned
            .map((entry: any) => Number(entry?.id || 0))
            .filter((id: number) => id > 0)
        : [];
      const defaultCategoryId = Number(
        detailData?.category?.default?.id ??
          detailData?.defaultCategoryId ??
          detailData?.defaultCategory?.id ??
          detailData?.categoryId ??
          0,
      );

      ensure(
        assignedCategories.length >= 1 && assignedCategories.includes(firstCategory!.id),
        "Seller detail response no longer includes the remaining selected category.",
      );
      ensure(
        defaultCategoryId === firstCategory!.id,
        "Seller detail response default category no longer matches the fallback category.",
      );
      ensure(
        await page.getByText(`Default category: ${firstCategory!.name}`, { exact: false }).first().isVisible(),
        "Final edit page no longer shows the fallback default category.",
      );

      const screenshot = await saveScreenshotPath("03-final-edit-state.png");
      await page.screenshot({ path: screenshot, fullPage: true });

      return {
        summary: "Payload and final product detail stayed valid after create/edit category selection changes.",
        proof: {
          assignedCategories,
          defaultCategoryId,
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
    console.error("[seller-category-selector-smoke] FAILED", error);
    try {
      const artifactPaths = await writeArtifacts();
      log("artifacts written after failure", artifactPaths);
    } catch (artifactError) {
      console.error("[seller-category-selector-smoke] failed to write artifacts", artifactError);
    }
    process.exitCode = 1;
  });
