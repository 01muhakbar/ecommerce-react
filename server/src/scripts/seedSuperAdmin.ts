// server/src/scripts/seedSuperAdmin.ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { sequelize, User, syncDb } from "../models/index.js";

async function main() {
  try {
    console.log("[seed] Starting super admin seed script...");

    // Pastikan konek DB
    await sequelize.authenticate();
    console.log("[seed] Database connection authenticated successfully.");

    // Sync schema → tabel muncul di phpMyAdmin/MySQL
    await syncDb();
    console.log("[seed] DB schema synced.");

    const email = process.env.SEED_SUPER_EMAIL || "superadmin@local.dev";
    const passwordPlain = process.env.SEED_SUPER_PASS || "supersecure123";
    const hashed = await bcrypt.hash(passwordPlain, 10);

    const existing = await User.findOne({ where: { email } });
    if (!existing) {
      await User.create({
        name: "Super Admin",
        email,
        password: hashed,
        role: "super_admin",
        status: "active",
      });
      console.log(`[seed] ✅ Super admin created: ${email} / ${passwordPlain}`);
    } else {
      const patch: Record<string, unknown> = {};

      const currentName = String(existing.get("name") ?? "").trim();
      const currentRole = String(existing.get("role") ?? "").trim().toLowerCase();
      const currentStatus = String(existing.get("status") ?? "").trim().toLowerCase();
      const currentPasswordHash = String(existing.get("password") ?? "");

      if (!currentName) patch.name = "Super Admin";
      if (currentRole !== "super_admin") patch.role = "super_admin";
      if (currentStatus !== "active") patch.status = "active";

      const passwordMatch =
        currentPasswordHash && (await bcrypt.compare(passwordPlain, currentPasswordHash));
      if (!passwordMatch) patch.password = hashed;

      if (Object.keys(patch).length > 0) {
        await existing.update(patch as any);
        console.log(`[seed] ✅ Super admin repaired: ${email}`);
      } else {
        console.log(`[seed] ℹ️ Super admin already valid: ${email}`);
      }
    }

    console.log("[seed] Done!");
  } catch (err) {
    console.error("[seed] Error:", err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
