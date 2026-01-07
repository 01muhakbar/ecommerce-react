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
        const [user, created] = await User.findOrCreate({
            where: { email },
            defaults: {
                name: "Super Admin",
                email,
                password: hashed,
                role: "super_admin",
                status: "active",
            },
        });
        if (created) {
            console.log(`[seed] ✅ Super admin created: ${email} / ${passwordPlain}`);
        }
        else {
            console.log(`[seed] ℹ️ Super admin already exists: ${email}`);
        }
        console.log("[seed] Done!");
    }
    catch (err) {
        console.error("[seed] Error:", err);
        process.exitCode = 1;
    }
    finally {
        await sequelize.close();
    }
}
main();
