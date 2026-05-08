import "dotenv/config";
import { resetDbDev } from "../models/index.js";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("reset-db is disabled in production.");
  }

  try {
    console.log("[reset-db] Starting database reset...");
    await resetDbDev();
    console.log("[reset-db] Database reset complete.");
  } catch (err) {
    console.error("[reset-db] Error:", err);
    process.exitCode = 1;
  }
}

main();
