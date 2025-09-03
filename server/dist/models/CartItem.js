"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartItem = void 0;
const sequelize_1 = require("sequelize");
class CartItem extends sequelize_1.Model {
    static associate(models) {
        // No explicit associations defined here, as it's a through model
    }
    static initModel(sequelize) {
        CartItem.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            cartId: {
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
                defaultValue: 1,
            },
        }, {
            sequelize,
            modelName: "CartItem",
        });
        return CartItem;
    }
}
exports.CartItem = CartItem;
