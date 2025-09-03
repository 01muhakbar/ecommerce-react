"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cart = void 0;
const sequelize_1 = require("sequelize");
class Cart extends sequelize_1.Model {
    static associate(models) {
        Cart.belongsTo(models.User, { foreignKey: "userId" });
        Cart.belongsToMany(models.Product, {
            through: models.CartItem,
            foreignKey: "cartId",
            otherKey: "productId",
        });
    }
    static initModel(sequelize) {
        Cart.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                unique: true,
            },
        }, {
            sequelize,
            modelName: "Cart",
        });
        return Cart;
    }
}
exports.Cart = Cart;
