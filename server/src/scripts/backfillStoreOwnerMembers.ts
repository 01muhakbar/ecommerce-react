import "dotenv/config";
import { sequelize } from "../models/index.js";
import {
  backfillOwnerStoreMembers,
  OwnerBackfillMode,
} from "../services/seller/backfillOwnerMembers.js";

function resolveMode(argv: string[]): OwnerBackfillMode {
  const explicitMode = argv.find((arg) => arg.startsWith("--mode="));
  if (explicitMode) {
    const value = explicitMode.split("=")[1];
    if (value === "dry-run" || value === "apply" || value === "report") {
      return value;
    }
  }

  if (argv.includes("--apply")) return "apply";
  if (argv.includes("--report")) return "report";
  return "dry-run";
}

function printSummary(mode: OwnerBackfillMode, report: Awaited<ReturnType<typeof backfillOwnerStoreMembers>>) {
  const { summary, anomalies, items } = report;

  console.log(`[owner-backfill] Mode: ${mode}`);
  console.log(`[owner-backfill] Total stores scanned: ${summary.totalStoresScanned}`);
  console.log(`[owner-backfill] Total valid stores: ${summary.totalValidStores}`);
  console.log(`[owner-backfill] Inserted: ${summary.insertedCount}`);
  console.log(`[owner-backfill] Normalized: ${summary.normalizedCount}`);
  console.log(`[owner-backfill] No-op: ${summary.noopCount}`);
  console.log(`[owner-backfill] Anomalies: ${summary.anomalyCount}`);

  const actionable = items.filter((item) => item.action !== "noop");
  if (actionable.length > 0) {
    console.log("[owner-backfill] Actionable items:");
    for (const item of actionable) {
      console.log(
        `  - store=${item.storeId} owner=${item.ownerUserId ?? "null"} action=${item.action} reasons=${item.reasons.join(
          " | "
        )}`
      );
    }
  }

  if (anomalies.length > 0) {
    console.log("[owner-backfill] Anomalies:");
    for (const anomaly of anomalies) {
      console.log(
        `  - store=${anomaly.storeId} owner=${anomaly.ownerUserId ?? "null"} code=${anomaly.anomalyCode} reasons=${anomaly.reasons.join(
          " | "
        )}`
      );
    }
  }
}

async function main() {
  const mode = resolveMode(process.argv.slice(2));

  try {
    console.log("[owner-backfill] Starting...");
    await sequelize.authenticate();
    const report = await backfillOwnerStoreMembers(mode);
    printSummary(mode, report);
    console.log("[owner-backfill] Done.");
  } catch (error) {
    console.error("[owner-backfill] Failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
