"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItem = void 0;
const sequelize_1 = require("sequelize");
class OrderItem extends sequelize_1.Model {
    static associate(models) {
        OrderItem.belongsTo(models.Order, { foreignKey: "orderId" });
        OrderItem.belongsTo(models.Product, { foreignKey: "productId" });
    }
    static initModel(sequelize) {
        OrderItem.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            orderId: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            productId: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            quantity: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
            },
            price: {
                type: sequelize_1.DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
        }, {
            sequelize,
            modelName: "OrderItem",
        });
        return OrderItem;
    }
}
exports.OrderItem = OrderItem;
