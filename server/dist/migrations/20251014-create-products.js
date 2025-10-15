// server/src/migrations/20251014-create-products.ts
import { DataTypes } from "sequelize";
export async function up(queryInterface) {
    await queryInterface.createTable("products", {
        id: {
            type: DataTypes.INTEGER.UNSIGNED,
            primaryKey: true,
            autoIncrement: true,
        },
        name: { type: DataTypes.STRING(255), allowNull: false },
        sku: { type: DataTypes.STRING(100), allowNull: true },
        price: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false,
            defaultValue: 0,
        },
        stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        status: {
            type: DataTypes.ENUM("active", "inactive"),
            allowNull: false,
            defaultValue: "active",
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    });
}
export async function down(queryInterface) {
    await queryInterface.dropTable("products");
}
