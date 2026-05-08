import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { config as loadEnv } from "dotenv";
import { QueryTypes } from "sequelize";
import { chromium } from "playwright";

loadEnv({ path: path.resolve(process.cwd(), "server/.env") });

let sequelize: any = null;

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

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  status: string;
  published: boolean | number;
  promoImagePath: string | null;
  imagePaths: string[] | string | null;
  price: number | string | null;
  salePrice: number | string | null;
  stock: number | string | null;
  defaultCategoryId: number | null;
  categoryId: number | null;
  sellerSubmissionStatus: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

const SERVER_BASE_URL = String(process.env.SELLER_FLOW_BASE_URL || "http://localhost:3001").replace(
  /\/+$/,
  ""
);
const STORE_SLUG = String(process.env.SELLER_FLOW_STORE_SLUG || "super-admin-1").trim();
const SELLER_EMAIL = String(process.env.SELLER_FLOW_EMAIL || "superadmin@local.dev").trim();
const SELLER_PASSWORD = String(process.env.SELLER_FLOW_PASSWORD || "supersecure123").trim();
const RUN_STAMP = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\.\d{3}Z$/, "z");
const RUN_ID = `svflow-${RUN_STAMP}-${Math.random().toString(36).slice(2, 8)}`;
const REPORT_DIR = path.resolve(process.cwd(), "reports", `seller-product-client-flow-${RUN_ID}`);

const PRODUCT_NAME = `SV Flow ${RUN_ID}`;
const EDITED_PRODUCT_NAME = `${PRODUCT_NAME} Edited`;
const PRODUCT_DESCRIPTION = `Seller to client validation draft for ${RUN_ID}.`;
const EDITED_PRODUCT_DESCRIPTION = `Edited product validation payload for ${RUN_ID}.`;
const PRODUCT_SKU = `SVF-${RUN_ID}`.slice(0, 60);
const PRODUCT_SLUG = `${RUN_ID}-draft`;
const EDITED_PRODUCT_SLUG = `${RUN_ID}-edited`;
const PRIMARY_IMAGE_FIXTURE = path.resolve(
  process.cwd(),
  "server",
  "uploads",
  "1770829603721-3ncw5zbc.jpg"
);
const SECONDARY_IMAGE_FIXTURE = path.resolve(process.cwd(), "reports", "slider-qa", "short.png");

const report: {
  runId: string;
  startedAt: string;
  serverBaseUrl: string;
  clientBaseUrl: string | null;
  storeSlug: string;
  sellerEmail: string;
  productId: number | null;
  finalProductSlug: string | null;
  screenshots: string[];
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
  clientBaseUrl: null,
  storeSlug: STORE_SLUG,
  sellerEmail: SELLER_EMAIL,
  productId: null,
  finalProductSlug: null,
  screenshots: [],
  steps: [],
  overallStatus: "passed",
};

class HttpClient {
  private cookie = "";

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

    const response = await fetch(absoluteUrl, { ...init, headers });
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0] || this.cookie;

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
  console.log(`[seller-product-client-flow] ${line}`);
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

const pickClientBaseUrl = async () => {
  let loggedClientUrl = "";
  try {
    const viteLog = await fs.readFile(
      path.resolve(process.cwd(), "tmp_task_products_flow_client.out"),
      "utf8"
    );
    const matched = viteLog.match(/http:\/\/localhost:\d+\//i);
    if (matched?.[0]) loggedClientUrl = matched[0].replace(/\/+$/, "");
  } catch {
    // ignore missing temp log
  }

  const candidates = [
    loggedClientUrl,
    process.env.SELLER_FLOW_CLIENT_URL,
    "http://localhost:5174",
    "http://localhost:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5173",
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, { redirect: "manual" });
      if (response.ok || response.status === 304) return candidate.replace(/\/+$/, "");
    } catch {
      // try next candidate
    }
  }

  throw new Error("Client dev server is not reachable on the expected Vite ports.");
};

const getProductRow = async (productId: number) => {
  const rows = (await sequelize.query(
    `
      SELECT
        id,
        name,
        slug,
        status,
        published,
        promo_image_path AS promoImagePath,
        image_paths AS imagePaths,
        price,
        sale_price AS salePrice,
        stock,
        default_category_id AS defaultCategoryId,
        category_id AS categoryId,
        seller_submission_status AS sellerSubmissionStatus,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM products
      WHERE id = :productId
      LIMIT 1
    `,
    {
      replacements: { productId },
      type: QueryTypes.SELECT,
    }
  )) as ProductRow[];

  return rows[0] || null;
};

const normalizeImagePaths = (value: ProductRow["imagePaths"]) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry || "")) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const toBodyData = (body: any) => body?.data ?? body;

const poll = async <T>(options: {
  label: string;
  timeoutMs?: number;
  intervalMs?: number;
  fn: () => Promise<T>;
  until: (value: T) => boolean;
}) => {
  const timeoutMs = options.timeoutMs ?? 7500;
  const intervalMs = options.intervalMs ?? 500;
  const startedAt = Date.now();
  let lastValue: T | null = null;

  while (Date.now() - startedAt <= timeoutMs) {
    lastValue = await options.fn();
    if (options.until(lastValue)) {
      return { value: lastValue, elapsedMs: Date.now() - startedAt };
    }
    await sleep(intervalMs);
  }

  const error = new Error(`${options.label} did not reach the expected state within ${timeoutMs}ms.`);
  (error as any).lastValue = lastValue;
  throw error;
};

const uploadFixture = async (client: HttpClient, filePath: string) => {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const type =
    ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "";
  const form = new FormData();
  form.append("file", new Blob([buffer], { type }), path.basename(filePath));
  const response = await client.request("/api/upload", {
    method: "POST",
    body: form,
  });

  ensure(
    response.status === 201 && response.body?.success === true && response.body?.data?.url,
    `Image upload failed for ${path.basename(filePath)}.`,
    response.body?.message || "Upload endpoint rejected the fixture."
  );

  const url = String(response.body.data.url);
  const assetResponse = await fetch(`${SERVER_BASE_URL}${url}`);
  ensure(
    assetResponse.ok,
    `Uploaded asset ${url} is not reachable from the backend.`,
    "Upload succeeded, but the returned asset URL is not publicly readable."
  );

  return url;
};

const saveScreenshotPath = async (name: string) => {
  const filePath = path.resolve(REPORT_DIR, sanitizeFileName(name));
  report.screenshots.push(filePath);
  return filePath;
};

const writeArtifacts = async () => {
  const reportJsonPath = path.resolve(REPORT_DIR, "report.json");
  const reportMdPath = path.resolve(REPORT_DIR, "report.md");
  const lines = [
    "# Seller Product Client Flow Report",
    "",
    `- Run ID: \`${report.runId}\``,
    `- Started At: \`${report.startedAt}\``,
    `- Server Base URL: \`${report.serverBaseUrl}\``,
    `- Client Base URL: \`${report.clientBaseUrl || "-"}\``,
    `- Store Slug: \`${report.storeSlug}\``,
    `- Seller Email: \`${report.sellerEmail}\``,
    `- Product ID: \`${report.productId ?? "-"}\``,
    `- Final Product Slug: \`${report.finalProductSlug ?? "-"}\``,
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
  fn: () => Promise<{ summary: string; proof?: Record<string, any> }>
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

async function main() {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const models = await import("../../server/src/models/index.js");
  sequelize = models.sequelize;

  const client = new HttpClient();
  const clientBaseUrl = await pickClientBaseUrl();
  report.clientBaseUrl = clientBaseUrl;

  const authHealth = await fetch(`${SERVER_BASE_URL}/api/auth/health`);
  ensure(authHealth.ok, "Server auth health endpoint is not reachable.", "Backend server is not running on port 3001.");

  let storeId = 0;
  let categoryId = 0;
  let categoryName = "";
  let uploadedPrimaryImage = "";
  let uploadedSecondaryImage = "";
  let productId = 0;
  let currentSlug = PRODUCT_SLUG;

  await runStep("1", "Create product from Seller", async () => {
    let loginResponse: JsonResponse | null = null;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      loginResponse = await client.request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: SELLER_EMAIL, password: SELLER_PASSWORD }),
      });
      if (loginResponse.status !== 429) break;
      const retryAfterSeconds = Math.max(
        1,
        Number(loginResponse.body?.data?.retryAfterSeconds || 5)
      );
      log("seller login rate limited", { attempt, retryAfterSeconds });
      await sleep((retryAfterSeconds + 1) * 1000);
    }
    ensure(
      loginResponse && loginResponse.status === 200 && loginResponse.body?.success === true,
      "Seller login failed before product creation.",
      loginResponse?.body?.message || "Seller credentials or session bootstrap failed."
    );

    const contextResponse = await client.request(
      `/api/seller/stores/slug/${encodeURIComponent(STORE_SLUG)}/context`
    );
    ensure(
      contextResponse.status === 200 && contextResponse.body?.success === true,
      "Seller store context failed to load.",
      contextResponse.body?.message || "Seller account does not have access to the target store."
    );

    const contextData = toBodyData(contextResponse.body);
    storeId = Number(contextData?.store?.id || 0);
    ensure(storeId > 0, "Seller store context did not return a valid store id.");

    const permissions = Array.isArray(contextData?.access?.permissionKeys)
      ? contextData.access.permissionKeys
      : [];
    ensure(
      permissions.includes("PRODUCT_CREATE") && permissions.includes("PRODUCT_PUBLISH"),
      "Seller context does not include create/publish permissions.",
      "The authenticated seller account is missing product create/publish permissions."
    );

    const metaResponse = await client.request(`/api/seller/stores/${storeId}/products/authoring/meta`);
    ensure(
      metaResponse.status === 200 && metaResponse.body?.success === true,
      "Seller authoring metadata failed to load.",
      metaResponse.body?.message || "Authoring metadata endpoint is unavailable."
    );

    const categories = Array.isArray(metaResponse.body?.data?.references?.categories)
      ? metaResponse.body.data.references.categories
      : [];
    const category = categories.find((entry: any) => Number(entry?.id) > 0) || null;
    ensure(
      category,
      "Seller authoring metadata returned no usable category.",
      "Products cannot be published because seller references do not expose any categories."
    );
    categoryId = Number(category.id);
    categoryName = String(category.name || category.code || category.id);

    uploadedPrimaryImage = await uploadFixture(client, PRIMARY_IMAGE_FIXTURE);
    uploadedSecondaryImage = await uploadFixture(client, SECONDARY_IMAGE_FIXTURE);

    const createResponse = await client.request(`/api/seller/stores/${storeId}/products/drafts`, {
      method: "POST",
      body: JSON.stringify({
        name: PRODUCT_NAME,
        description: PRODUCT_DESCRIPTION,
        sku: PRODUCT_SKU,
        slug: PRODUCT_SLUG,
        categoryIds: [categoryId],
        defaultCategoryId: categoryId,
        price: 125000,
        salePrice: 99000,
        stock: 8,
        imageUrls: [uploadedPrimaryImage, uploadedSecondaryImage],
        tags: ["seller-flow", RUN_ID],
      }),
    });
    ensure(
      createResponse.status === 201 && createResponse.body?.success === true,
      "Seller draft creation failed.",
      createResponse.body?.message || "Seller draft endpoint rejected the payload."
    );

    const created = createResponse.body?.data || {};
    productId = Number(created?.id || 0);
    currentSlug = String(created?.slug || PRODUCT_SLUG);
    report.productId = productId;
    report.finalProductSlug = currentSlug;
    ensure(productId > 0, "Draft creation returned an invalid product id.");

    return {
      summary: "Seller authentication, store context, image upload, and draft creation completed.",
      proof: {
        storeId,
        categoryId,
        categoryName,
        uploadedPrimaryImage,
        uploadedSecondaryImage,
        productId,
        slug: currentSlug,
        createStatus: createResponse.status,
      },
    };
  });

  await runStep("2", "Save as draft and check DB/API response", async () => {
    const dbRow = await getProductRow(productId);
    ensure(dbRow, "Created draft was not found in the database.");
    const imagePaths = normalizeImagePaths(dbRow.imagePaths);
    ensure(String(dbRow.status) === "draft", "Draft row is not persisted with status=draft.");
    ensure(Number(dbRow.published) === 0, "Draft row is unexpectedly published in the database.");
    ensure(
      dbRow.promoImagePath === uploadedPrimaryImage,
      "Draft promo image does not match the first uploaded image.",
      "Draft save did not keep the first image as promoImagePath."
    );
    ensure(
      imagePaths[0] === uploadedPrimaryImage && imagePaths[1] === uploadedSecondaryImage,
      "Draft image ordering in DB does not match the authoring payload.",
      "Draft imagePaths were not stored in the same order sent by seller authoring."
    );

    const sellerDetailResponse = await client.request(`/api/seller/stores/${storeId}/products/${productId}`);
    ensure(
      sellerDetailResponse.status === 200 && sellerDetailResponse.body?.success === true,
      "Seller detail endpoint failed after draft creation."
    );

    const publicListResponse = await fetch(
      `${SERVER_BASE_URL}/api/store/products?storeSlug=${encodeURIComponent(STORE_SLUG)}&search=${encodeURIComponent(RUN_ID)}&page=1&limit=24`
    );
    const publicListBody = await publicListResponse.json();
    const publicItems = Array.isArray(publicListBody?.data) ? publicListBody.data : [];
    ensure(
      publicItems.every((entry: any) => String(entry?.slug || "") !== currentSlug),
      "Draft product is already visible in public store listing.",
      "Public store listing exposed a draft product before seller publish."
    );

    const publicDetailResponse = await fetch(
      `${SERVER_BASE_URL}/api/store/products/${encodeURIComponent(currentSlug)}?storeSlug=${encodeURIComponent(STORE_SLUG)}`
    );
    ensure(
      publicDetailResponse.status === 404,
      "Draft product detail is already public before publish.",
      "Public product detail returned a draft product."
    );

    return {
      summary: "Draft state is consistent across seller API and database, and remains hidden from public client APIs.",
      proof: {
        dbStatus: dbRow.status,
        dbPublished: Number(dbRow.published),
        promoImagePath: dbRow.promoImagePath,
        imagePaths,
        publicListContainsDraft: false,
        publicDetailStatus: publicDetailResponse.status,
      },
    };
  });

  await runStep("3", "Publish product", async () => {
    const publishResponse = await client.request(
      `/api/seller/stores/${storeId}/products/${productId}/published`,
      {
        method: "PATCH",
        body: JSON.stringify({ published: true }),
      }
    );
    ensure(
      publishResponse.status === 200 && publishResponse.body?.success === true,
      "Seller publish request failed.",
      publishResponse.body?.message || "Publish endpoint rejected a publish-ready product."
    );

    const publishData = publishResponse.body?.data || {};
    ensure(
      publishData?.visibility?.storefrontVisible === true,
      "Seller publish response did not mark the product as storefrontVisible.",
      publishData?.visibility?.storefrontReason ||
        "Seller publish endpoint returned a non-public visibility snapshot."
    );

    const dbRow = await getProductRow(productId);
    ensure(dbRow, "Published product row is missing in the database.");
    ensure(String(dbRow.status) === "active", "Published product did not switch to status=active.");
    ensure(Number(dbRow.published) === 1, "Published product did not persist published=true in the database.");

    return {
      summary: "Seller publish succeeded and persisted active/public product state.",
      proof: {
        publishStatus: publishResponse.status,
        responseVisibility: publishData?.visibility,
        dbStatus: dbRow.status,
        dbPublished: Number(dbRow.published),
      },
    };
  });

  await runStep("4", "Open Client and check product appears", async () => {
    const publicListPoll = await poll({
      label: "public store list visibility",
      fn: async () => {
        const response = await fetch(
          `${SERVER_BASE_URL}/api/store/products?storeSlug=${encodeURIComponent(STORE_SLUG)}&search=${encodeURIComponent(RUN_ID)}&page=1&limit=24`
        );
        const body = await response.json();
        return { status: response.status, body };
      },
      until: (result) =>
        result.status === 200 &&
        Array.isArray(result.body?.data) &&
        result.body.data.some((entry: any) => String(entry?.slug || "") === currentSlug),
    });

    const publicDetailPoll = await poll({
      label: "public store detail visibility",
      fn: async () => {
        const response = await fetch(
          `${SERVER_BASE_URL}/api/store/products/${encodeURIComponent(currentSlug)}?storeSlug=${encodeURIComponent(STORE_SLUG)}`
        );
        const body = response.status === 200 ? await response.json() : null;
        return { status: response.status, body };
      },
      until: (result) => result.status === 200 && String(result.body?.data?.slug || "") === currentSlug,
    });

    const publicListItem = publicListPoll.value.body.data.find(
      (entry: any) => String(entry?.slug || "") === currentSlug
    );

    const browser = await chromium.launch({ headless: true });
    let listingImageSrc: string | null = null;
    let listingHasImage = false;
    const listUrl = `${clientBaseUrl}/store/${encodeURIComponent(STORE_SLUG)}?view=products&q=${encodeURIComponent(RUN_ID)}`;
    const listingScreenshot = await saveScreenshotPath("04-client-listing-published.png");
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
      await page.goto(listUrl, { waitUntil: "domcontentloaded" });
      await page.locator("article").filter({ hasText: PRODUCT_NAME }).first().waitFor({ timeout: 20000 });
      const listingCard = page.locator("article").filter({ hasText: PRODUCT_NAME }).first();
      await page.screenshot({ path: listingScreenshot, fullPage: true });
      listingHasImage = (await listingCard.locator("img").count()) > 0;
      listingImageSrc = listingHasImage
        ? await listingCard.locator("img").first().getAttribute("src")
        : null;
    } finally {
      await browser.close();
    }

    return {
      summary: "Published product became visible in public API and client listing without delay symptoms.",
      proof: {
        publicListVisibleAfterMs: publicListPoll.elapsedMs,
        publicDetailVisibleAfterMs: publicDetailPoll.elapsedMs,
        publicListImageUrl: publicListItem?.imageUrl || null,
        listingUrl: listUrl,
        listingHasImage,
        listingImageSrc,
        screenshot: listingScreenshot,
      },
    };
  });

  await runStep("5", "Edit product and check changes in Client", async () => {
    const updateResponse = await client.request(
      `/api/seller/stores/${storeId}/products/${productId}/draft`,
      {
        method: "PATCH",
        body: JSON.stringify({
          name: EDITED_PRODUCT_NAME,
          description: EDITED_PRODUCT_DESCRIPTION,
          sku: PRODUCT_SKU,
          slug: EDITED_PRODUCT_SLUG,
          categoryIds: [categoryId],
          defaultCategoryId: categoryId,
          price: 125000,
          salePrice: 95000,
          stock: 9,
          imageUrls: [uploadedSecondaryImage, uploadedPrimaryImage],
          tags: ["seller-flow", RUN_ID, "edited"],
        }),
      }
    );
    ensure(
      updateResponse.status === 200 && updateResponse.body?.success === true,
      "Seller edit request failed after publish.",
      updateResponse.body?.message || "Seller draft patch endpoint rejected the edit."
    );

    const updated = updateResponse.body?.data || {};
    currentSlug = String(updated?.slug || EDITED_PRODUCT_SLUG);
    report.finalProductSlug = currentSlug;

    const dbRow = await getProductRow(productId);
    ensure(dbRow, "Edited product row is missing in the database.");
    const imagePaths = normalizeImagePaths(dbRow.imagePaths);
    ensure(dbRow.name === EDITED_PRODUCT_NAME, "Edited product name was not persisted in the database.");
    ensure(dbRow.slug === currentSlug, "Edited product slug in database does not match seller response.");
    ensure(
      dbRow.promoImagePath === uploadedSecondaryImage && imagePaths[0] === uploadedSecondaryImage,
      "Edited product did not promote the second image to primary.",
      "Seller edit reordered imageUrls, but promoImagePath/imagePaths[0] did not follow."
    );
    ensure(Number(dbRow.published) === 1, "Editing the product unexpectedly unpublished it in the database.");

    await poll({
      label: "edited product public detail refresh",
      fn: async () => {
        const response = await fetch(
          `${SERVER_BASE_URL}/api/store/products/${encodeURIComponent(currentSlug)}?storeSlug=${encodeURIComponent(STORE_SLUG)}`
        );
        const body = response.status === 200 ? await response.json() : null;
        return { status: response.status, body };
      },
      until: (result) =>
        result.status === 200 &&
        String(result.body?.data?.name || "") === EDITED_PRODUCT_NAME &&
        String(result.body?.data?.description || "") === EDITED_PRODUCT_DESCRIPTION,
    });

    const browser = await chromium.launch({ headless: true });
    let editedListingHasImage = false;
    let editedListingImageSrc: string | null = null;
    let detailHasImage = false;
    let detailImageSrc: string | null = null;
    const listingUrl = `${clientBaseUrl}/store/${encodeURIComponent(STORE_SLUG)}?view=products&q=${encodeURIComponent(RUN_ID)}`;
    const listingScreenshot = await saveScreenshotPath("05-client-listing-edited-primary.png");
    const detailUrl = `${clientBaseUrl}/store/${encodeURIComponent(STORE_SLUG)}/products/${encodeURIComponent(currentSlug)}`;
    const detailScreenshot = await saveScreenshotPath("06-client-detail-edited.png");
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
      await page.goto(listingUrl, { waitUntil: "domcontentloaded" });
      await page.locator("article").filter({ hasText: EDITED_PRODUCT_NAME }).first().waitFor({ timeout: 20000 });
      const editedCard = page.locator("article").filter({ hasText: EDITED_PRODUCT_NAME }).first();
      await page.screenshot({ path: listingScreenshot, fullPage: true });
      editedListingHasImage = (await editedCard.locator("img").count()) > 0;
      editedListingImageSrc = editedListingHasImage
        ? await editedCard.locator("img").first().getAttribute("src")
        : null;

      await page.goto(detailUrl, { waitUntil: "domcontentloaded" });
      await page.locator("h1").filter({ hasText: EDITED_PRODUCT_NAME }).first().waitFor({ timeout: 20000 });
      const detailBodyText = await page.locator("body").textContent();
      ensure(
        String(detailBodyText || "").includes(EDITED_PRODUCT_DESCRIPTION),
        "Edited product description is not visible on the client detail page.",
        "Client detail page did not reflect the seller-edited description."
      );
      await page.screenshot({ path: detailScreenshot, fullPage: true });
      detailHasImage = (await page.locator(`img[alt="${EDITED_PRODUCT_NAME}"]`).count()) > 0;
      detailImageSrc = detailHasImage
        ? await page.locator(`img[alt="${EDITED_PRODUCT_NAME}"]`).first().getAttribute("src")
        : null;
    } finally {
      await browser.close();
    }

    return {
      summary: "Seller edit propagated to DB and client, including primary image order and description changes.",
      proof: {
        updatedSlug: currentSlug,
        listingUrl,
        detailUrl,
        dbPromoImagePath: dbRow.promoImagePath,
        editedListingHasImage,
        editedListingImageSrc,
        detailHasImage,
        detailImageSrc,
        listingScreenshot,
        detailScreenshot,
      },
    };
  });

  await runStep("6", "Test unpublish and ensure product disappears from Client", async () => {
    const unpublishResponse = await client.request(
      `/api/seller/stores/${storeId}/products/${productId}/published`,
      {
        method: "PATCH",
        body: JSON.stringify({ published: false }),
      }
    );
    ensure(
      unpublishResponse.status === 200 && unpublishResponse.body?.success === true,
      "Seller unpublish request failed.",
      unpublishResponse.body?.message || "Unpublish endpoint rejected the request."
    );

    const dbRow = await getProductRow(productId);
    ensure(dbRow, "Unpublished product row is missing in the database.");
    ensure(Number(dbRow.published) === 0, "Unpublish did not persist published=false in the database.");

    const publicListPoll = await poll({
      label: "public store list hide after unpublish",
      fn: async () => {
        const response = await fetch(
          `${SERVER_BASE_URL}/api/store/products?storeSlug=${encodeURIComponent(STORE_SLUG)}&search=${encodeURIComponent(RUN_ID)}&page=1&limit=24`
        );
        const body = await response.json();
        return { status: response.status, body };
      },
      until: (result) =>
        result.status === 200 &&
        Array.isArray(result.body?.data) &&
        result.body.data.every((entry: any) => String(entry?.slug || "") !== currentSlug),
    });

    const publicDetailPoll = await poll({
      label: "public store detail hide after unpublish",
      fn: async () => {
        const response = await fetch(
          `${SERVER_BASE_URL}/api/store/products/${encodeURIComponent(currentSlug)}?storeSlug=${encodeURIComponent(STORE_SLUG)}`
        );
        return { status: response.status };
      },
      until: (result) => result.status === 404,
    });

    const browser = await chromium.launch({ headless: true });
    const listingUrl = `${clientBaseUrl}/store/${encodeURIComponent(STORE_SLUG)}?view=products&q=${encodeURIComponent(RUN_ID)}`;
    const listingScreenshot = await saveScreenshotPath("07-client-listing-unpublished.png");
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
      await page.goto(listingUrl, { waitUntil: "domcontentloaded" });
      await page.locator("text=No products in this category.").waitFor({ timeout: 20000 });
      await page.screenshot({ path: listingScreenshot, fullPage: true });
    } finally {
      await browser.close();
    }

    return {
      summary: "Unpublish immediately removed the product from public API and client listing.",
      proof: {
        dbPublished: Number(dbRow.published),
        publicListHiddenAfterMs: publicListPoll.elapsedMs,
        publicDetailHiddenAfterMs: publicDetailPoll.elapsedMs,
        screenshot: listingScreenshot,
      },
    };
  });

  await runStep("7", "Test image primary in Client listing", async () => {
    const editStep = report.steps.find((step) => step.id === "5");
    ensure(editStep?.status === "passed", "Primary image validation cannot run because the edit step did not pass.");
    const proof = editStep?.proof || {};
    ensure(
      proof?.editedListingHasImage === true,
      "Client listing does not render a product <img> element after the seller changed the primary image.",
      "Public API and DB keep the edited primary image, but the storefront listing renders a placeholder instead of the product image."
    );
    ensure(
      String(proof?.editedListingImageSrc || "").includes(path.basename(uploadedSecondaryImage)),
      "Primary image validation proof from client listing is missing or incorrect.",
      "Client listing image source does not match the second image that seller promoted to primary."
    );

    return {
      summary: "Client listing uses the seller-selected primary image after reorder.",
      proof: {
        expectedPrimaryImage: uploadedSecondaryImage,
        clientListingImageSrc: proof?.editedListingImageSrc,
        screenshot: proof?.listingScreenshot,
      },
    };
  });
}

main()
  .catch((error) => {
    report.overallStatus = "failed";
    if (!report.failure) {
      report.failure = {
        stepId: "bootstrap",
        stepTitle: "Bootstrap",
        message: String((error as any)?.message || "Validation failed before step execution."),
        rootCause: String((error as any)?.rootCause || (error as any)?.message || "Validation bootstrap failed."),
      };
    }
    console.error("[seller-product-client-flow] FAILED", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      const artifactPaths = await writeArtifacts();
      log("artifacts written", artifactPaths);
    } catch (artifactError) {
      console.error("[seller-product-client-flow] failed to write artifacts", artifactError);
      process.exitCode = 1;
    }
    try {
      await sequelize.close();
    } catch {
      // ignore close errors for QA script shutdown
    }
  });
