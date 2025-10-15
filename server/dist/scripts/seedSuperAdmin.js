// server/src/scripts/seedSuperAdmin.ts
import "dotenv/config";
import bcrypt from "bcryptjs";
import sequelize from "../config/database.js";
import { DataTypes, Model } from "sequelize";
class User extends Model {
}
User.init({
    id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
    },
    email: { type: DataTypes.STRING(191), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(191), allowNull: false },
    role: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "super_admin",
    },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    createdAt: { type: DataTypes.DATE, allowNull: false, field: "created_at" },
    updatedAt: { type: DataTypes.DATE, allowNull: false, field: "updated_at" },
}, { sequelize, modelName: "User", tableName: "users", underscored: true });
async function main() {
    const email = process.env.SUPER_ADMIN_EMAIL || "admin@local";
    const rawPass = process.env.SUPER_ADMIN_PASSWORD || "admin123";
    const hash = await bcrypt.hash(rawPass, 10);
    await sequelize.authenticate();
    const existing = await User.findOne({ where: { email } });
    if (existing) {
        console.log(`[seed] Super admin already exists: ${email}`);
        return;
    }
    await User.create({
        email,
        password: hash,
        role: "super_admin",
        isActive: true,
    });
    console.log(`[seed] Super admin created: ${email} / ${rawPass}`);
}
main()
    .then(() => process.exit(0))
    .catch((e) => {
    console.error(e);
    process.exit(1);
});
