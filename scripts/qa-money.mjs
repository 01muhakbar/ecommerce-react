import fs from "node:fs/promises";
import path from "node:path";
import {
  formatMoney,
  formatDateTime,
} from "../client/src/utils/adminLocaleFormatters.js";
import { formatStoreMoney } from "../client/src/utils/storeMoneyFormatters.js";

const ROOT = process.cwd();
const CLIENT_SRC = path.join(ROOT, "client", "src");

const LITERAL_DOLLAR_REGEX = /\$\s?\d/;
const LITERAL_IDR_NUMBER_REGEX = /\bIDR\s?\d/;

const SKIP_SEGMENTS = new Set(["__snapshots__", "mocks"]);

const SCAN_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".mdx",
]);

const RELATIVE = (absPath) =>
  path.relative(ROOT, absPath).split(path.sep).join("/");

const shouldSkipPath = (absPath) =>
  absPath
    .split(path.sep)
    .some((segment) => SKIP_SEGMENTS.has(segment));

const isScannableFile = (absPath) =>
  SCAN_EXTENSIONS.has(path.extname(absPath).toLowerCase());

const readDirRecursive = async (dirPath) => {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (shouldSkipPath(fullPath)) continue;
    if (entry.isDirectory()) {
      files.push(...(await readDirRecursive(fullPath)));
      continue;
    }
    if (entry.isFile() && isScannableFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
};

const scanClientSource = async () => {
  const files = await readDirRecursive(CLIENT_SRC);
  const findings = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (LITERAL_DOLLAR_REGEX.test(line)) {
        findings.push({
          type: "DOLLAR_LITERAL",
          file: RELATIVE(filePath),
          line: index + 1,
          snippet: line.trim(),
        });
      }
      if (LITERAL_IDR_NUMBER_REGEX.test(line)) {
        findings.push({
          type: "IDR_NUMBER_LITERAL",
          file: RELATIVE(filePath),
          line: index + 1,
          snippet: line.trim(),
        });
      }
    });
  }

  return findings;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runFormatterAssertions = () => {
  const settings = {
    defaultCurrency: "IDR",
    defaultTimeZone: "Asia/Makassar",
    defaultDateFormat: "D MMM, YYYY",
  };

  const adminEn = formatMoney(29900, settings, "en");
  const adminId = formatMoney(29900, settings, "id");
  const store = formatStoreMoney(29900, "IDR");

  assert(/Rp/.test(adminEn), `admin(en) should include Rp, got: ${adminEn}`);
  assert(!/\bIDR\b/.test(adminEn), `admin(en) should not include IDR, got: ${adminEn}`);
  assert(/Rp/.test(adminId), `admin(id) should include Rp, got: ${adminId}`);
  assert(!/\bIDR\b/.test(adminId), `admin(id) should not include IDR, got: ${adminId}`);
  assert(/Rp/.test(store), `store should include Rp, got: ${store}`);
  assert(!/\bIDR\b/.test(store), `store should not include IDR, got: ${store}`);

  // keep one date formatting call so imported module path is exercised in same runtime
  formatDateTime(new Date().toISOString(), settings, "id");
};

const main = async () => {
  const findings = await scanClientSource();

  if (findings.length > 0) {
    console.error("QA-MONEY: FAIL");
    console.error("Found forbidden money literals:");
    for (const hit of findings) {
      console.error(
        `- [${hit.type}] ${hit.file}:${hit.line} -> ${hit.snippet}`
      );
    }
    process.exit(1);
  }

  try {
    runFormatterAssertions();
  } catch (error) {
    console.error("QA-MONEY: FAIL");
    console.error(`Formatter assertion failed: ${error.message}`);
    process.exit(1);
  }

  console.log("QA-MONEY: PASS");
};

main().catch((error) => {
  console.error("QA-MONEY: FAIL");
  console.error(error?.stack || String(error));
  process.exit(1);
});
