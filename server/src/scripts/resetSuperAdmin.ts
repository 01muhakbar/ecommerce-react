import bcrypt from "bcryptjs";
import { User } from "../models/index.js";

// This script is intended to be run with ts-node
// It resets the super admin password to the one in the .env file or the hardcoded default.

const resetSuperAdminPassword = async () => {
  console.log("Attempting to reset Super Admin password...");
  // models are initialized on import; use Staff directly

  const email = process.env.ADMIN_EMAIL || "super@admin.com";
  const pass = process.env.ADMIN_PASSWORD || "supersecret123";

  try {
  const sa = await User.findOne({ where: { email, role: "super_admin" } });

    if (!sa) {
      console.error(`Error: Super Admin with email '${email}' not found.`);
      process.exit(1);
    }

    console.log(`Found Super Admin: ${sa.email}. Updating password...`);
    (sa as any).password = await bcrypt.hash(pass, 10);
    await sa.save();

    console.log(`Password for ${email} has been reset successfully.`);
    process.exit(0);
  } catch (error) {
    console.error("An error occurred during password reset:", error);
    process.exit(1);
  }
};

resetSuperAdminPassword();


