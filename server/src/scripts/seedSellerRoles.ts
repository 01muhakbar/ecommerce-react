import "dotenv/config";
import { sequelize } from "../models/index.js";
import { ensureSystemStoreRoles } from "../services/seller/storeRoles.js";

async function main() {
  try {
    console.log("[seed:seller-roles] Starting...");
    await sequelize.authenticate();
    await ensureSystemStoreRoles();
    console.log("[seed:seller-roles] Seller roles ensured.");
  } catch (error) {
    console.error("[seed:seller-roles] Failed:", error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
