"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Product = void 0;
const sequelize_1 = require("sequelize");
class Product extends sequelize_1.Model {
    static associate(models) {
        Product.belongsToMany(models.Cart, {
            through: models.CartItem,
            foreignKey: "productId",
            otherKey: "cartId",
        });
        Product.belongsTo(models.User, {
            foreignKey: "userId",
            as: "seller",
            onDelete: "CASCADE",
        });
        Product.belongsTo(models.Category, {
            foreignKey: 'categoryId',
            as: 'category',
        });
        Product.belongsToMany(models.Order, {
            through: models.OrderItem,
            foreignKey: "productId",
            otherKey: "orderId",
        });
    }
    static initModel(sequelize) {
        Product.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            price: {
                type: sequelize_1.DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            stock: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            categoryId: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
        }, {
            sequelize,
            modelName: "Product",
        });
        return Product;
    }
}
exports.Product = Product;
