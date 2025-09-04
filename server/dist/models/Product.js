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
            foreignKey: "categoryId",
            as: "category",
            onDelete: "SET NULL", // Opsional: jika kategori dihapus, set categoryId di produk menjadi null
        });
        Product.belongsToMany(models.Order, {
            through: models.OrderItem,
            foreignKey: "productId",
            otherKey: "orderId",
            as: "orders", // Menambahkan alias yang konsisten
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
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            userId: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            status: {
                type: sequelize_1.DataTypes.ENUM("active", "archived", "draft"),
                defaultValue: "draft",
                allowNull: false,
            },
            gtin: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            notes: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
            parentSku: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            condition: {
                type: sequelize_1.DataTypes.ENUM("new", "used"),
                defaultValue: "new",
                allowNull: false,
            },
            weight: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: false, // in grams
            },
            length: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true, // in cm
            },
            width: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true, // in cm
            },
            height: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true, // in cm
            },
            dangerousProduct: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            preOrder: {
                type: sequelize_1.DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            preorderDays: {
                type: sequelize_1.DataTypes.INTEGER,
                allowNull: true,
            },
            youtubeLink: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            promoImagePath: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            imagePaths: {
                type: sequelize_1.DataTypes.JSON,
                allowNull: true,
            },
            videoPath: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            variations: {
                type: sequelize_1.DataTypes.JSON,
                allowNull: true,
            },
            wholesale: {
                type: sequelize_1.DataTypes.JSON,
                allowNull: true,
            },
            isPublished: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
        }, {
            sequelize,
            modelName: "Product",
            tableName: "Products", // Eksplisit nama tabel
        });
        return Product;
    }
}
exports.Product = Product;
