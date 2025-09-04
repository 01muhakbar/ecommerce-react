"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Order = void 0;
const sequelize_1 = require("sequelize");
class Order extends sequelize_1.Model {
    static associate(models) {
        Order.belongsTo(models.User, { foreignKey: "userId" });
        Order.belongsToMany(models.Product, {
            through: models.OrderItem,
            foreignKey: "orderId",
            otherKey: "productId",
            as: "products", // Tambahkan alias yang sesuai
        });
    }
    static initModel(sequelize) {
        Order.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            totalAmount: {
                type: sequelize_1.DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            status: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                defaultValue: "pending",
                validate: {
                    isIn: [["pending", "completed", "cancelled"]],
                },
            },
        }, {
            sequelize,
            modelName: "Order",
        });
        return Order;
    }
}
exports.Order = Order;
