// server/src/scripts/seedAdmin.ts
import "dotenv/config";
import bcrypt from "bcrypt";
import { sequelize, User } from "../models/index.js";
async function main() {
    try {
        console.log("[seed] Starting admin seed script...");
        await sequelize.authenticate();
        console.log("[seed] Database connection authenticated successfully.");
        const email = process.env.ADMIN_SEED_EMAIL || "admin@local.test";
        const passwordPlain = process.env.ADMIN_SEED_PASSWORD || "admin123";
        const hashed = await bcrypt.hash(passwordPlain, 10);
        const [user, created] = await User.findOrCreate({
            where: { email },
            defaults: {
                name: "Admin",
                email,
                password: hashed,
                role: "admin",
                status: "active",
            },
        });
        if (!created) {
            await user.update({
                password: hashed,
                role: "admin",
                status: "active",
            });
            console.log(`[seed] Updated admin: ${email} / ${passwordPlain}`);
        }
        else {
            console.log(`[seed] Created admin: ${email} / ${passwordPlain}`);
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
