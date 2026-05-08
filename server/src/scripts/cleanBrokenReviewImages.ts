import "dotenv/config";
import fs from "fs";
import path from "path";
import { ProductReview, sequelize } from "../models/index.js";

type CliOptions = {
  dryRun: boolean;
  verbose: boolean;
  timeoutMs: number;
};

type CheckResult = {
  ok: boolean;
  reason?: string;
};

const IMAGE_FILE_PATTERN = /\.(?:jpe?g|png)(?:$|[?#])/i;
const UPLOAD_ROOTS = [
  path.resolve(process.cwd(), "uploads"),
  path.resolve(process.cwd(), "public/uploads"),
  path.resolve(process.cwd(), "server/public/uploads"),
];

const parseOptions = (): CliOptions => {
  const args = process.argv.slice(2);
  const timeoutArg = args.find((arg) => arg.startsWith("--timeout-ms="));
  const timeoutValue = timeoutArg ? Number(timeoutArg.split("=")[1]) : NaN;

  return {
    dryRun: args.includes("--dry-run"),
    verbose: args.includes("--verbose"),
    timeoutMs: Number.isFinite(timeoutValue) && timeoutValue > 0 ? timeoutValue : 5000,
  };
};

const parseReviewImages = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) return [trimmed];
    return parsed.map((item) => String(item || "").trim()).filter(Boolean);
  } catch {
    return [trimmed];
  }
};

const getModelAttr = (row: any, key: string): unknown =>
  row?.getDataValue?.(key) ??
  row?.get?.(key) ??
  row?.dataValues?.[key] ??
  undefined;

const toUploadRelativePath = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return null;

  if (/^data:image\//i.test(value)) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const pathname = url.pathname || "";
      if (!pathname.startsWith("/uploads/")) return null;
      const rel = pathname.replace(/^\/uploads\//, "").trim();
      return rel || null;
    } catch {
      return null;
    }
  }

  const normalized = value.replace(/\\/g, "/");
  const candidates = [
    { prefix: "/uploads/", rel: normalized.replace(/^\/uploads\//, "") },
    { prefix: "uploads/", rel: normalized.replace(/^uploads\//, "") },
    { prefix: "/public/uploads/", rel: normalized.replace(/^\/public\/uploads\//, "") },
    { prefix: "public/uploads/", rel: normalized.replace(/^public\/uploads\//, "") },
    { prefix: "/server/public/uploads/", rel: normalized.replace(/^\/server\/public\/uploads\//, "") },
    { prefix: "server/public/uploads/", rel: normalized.replace(/^server\/public\/uploads\//, "") },
    { prefix: "/products/", rel: normalized.replace(/^\/products\//, "products/") },
    { prefix: "products/", rel: normalized },
  ];

  for (const candidate of candidates) {
    if (!normalized.startsWith(candidate.prefix)) continue;
    const rel = candidate.rel.replace(/^\/+/, "").trim();
    return rel || null;
  }

  return null;
};

const existsInUploadRoots = (relativePath: string): boolean => {
  for (const root of UPLOAD_ROOTS) {
    if (!fs.existsSync(root)) continue;
    const absolutePath = path.resolve(root, relativePath);
    if (!absolutePath.startsWith(root)) continue;
    if (fs.existsSync(absolutePath)) return true;
  }
  return false;
};

const checkRemoteUrl = async (url: string, timeoutMs: number): Promise<CheckResult> => {
  const run = async (method: "HEAD" | "GET") => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method,
        redirect: "follow",
        signal: controller.signal,
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const head = await run("HEAD");
    if (head.ok) return { ok: true };
    if (head.status === 405 || head.status === 501) {
      const get = await run("GET");
      if (get.ok) return { ok: true };
      return { ok: false, reason: `HTTP ${get.status}` };
    }
    return { ok: false, reason: `HTTP ${head.status}` };
  } catch (error: any) {
    return {
      ok: false,
      reason: error?.name === "AbortError" ? "Timeout" : (error?.message || "Request failed"),
    };
  }
};

const checkImageReference = async (image: string, timeoutMs: number): Promise<CheckResult> => {
  const value = String(image || "").trim();
  if (!value) return { ok: false, reason: "Empty value" };
  if (/^data:image\/(?:jpeg|png);base64,/i.test(value)) return { ok: true };
  if (!IMAGE_FILE_PATTERN.test(value)) return { ok: false, reason: "Not jpg/png" };

  const uploadRelativePath = toUploadRelativePath(value);
  if (uploadRelativePath) {
    return existsInUploadRoots(uploadRelativePath)
      ? { ok: true }
      : { ok: false, reason: "Missing local file" };
  }

  if (/^https?:\/\//i.test(value)) {
    return checkRemoteUrl(value, timeoutMs);
  }

  return { ok: false, reason: "Unsupported path format" };
};

const run = async () => {
  const options = parseOptions();
  await sequelize.authenticate();

  const reviews = await ProductReview.findAll({
    attributes: ["id", "images", "productId", "userId"],
    order: [["id", "ASC"]],
  });

  let scannedReviews = 0;
  let scannedImages = 0;
  let removedImages = 0;
  let updatedReviews = 0;

  for (const review of reviews) {
    scannedReviews += 1;
    const currentImages = parseReviewImages(getModelAttr(review, "images"));
    if (currentImages.length === 0) continue;

    const nextImages: string[] = [];
    let reviewRemovedCount = 0;

    for (const image of currentImages) {
      scannedImages += 1;
      const result = await checkImageReference(image, options.timeoutMs);
      if (result.ok) {
        nextImages.push(image);
        continue;
      }
      reviewRemovedCount += 1;
      removedImages += 1;
      if (options.verbose) {
        console.log(
          `[clean-review-images] remove review=${getModelAttr(review, "id")} product=${getModelAttr(review, "productId")} user=${getModelAttr(review, "userId")} image="${image}" reason="${result.reason || "Invalid"}"`
        );
      }
    }

    if (reviewRemovedCount === 0) continue;

    const payload = nextImages.length > 0 ? nextImages : null;
    updatedReviews += 1;

    if (!options.dryRun) {
      await review.update({ images: payload });
    }
  }

  console.log("[clean-review-images] done");
  console.log(`[clean-review-images] mode: ${options.dryRun ? "DRY_RUN" : "APPLY"}`);
  console.log(`[clean-review-images] reviews scanned: ${scannedReviews}`);
  console.log(`[clean-review-images] images scanned: ${scannedImages}`);
  console.log(`[clean-review-images] images removed: ${removedImages}`);
  console.log(`[clean-review-images] reviews updated: ${updatedReviews}`);
};

run()
  .catch((error) => {
    console.error("[clean-review-images] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
