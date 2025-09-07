import { DataTypes, Model } from "sequelize";
export class Product extends Model {
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
            onDelete: "SET NULL",
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
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            salePrice: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
            },
            slug: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            tags: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            stock: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            categoryId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
            userId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM("active", "archived", "draft"),
                defaultValue: "draft",
                allowNull: false,
            },
            gtin: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            parentSku: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            sku: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            barcode: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            condition: {
                type: DataTypes.ENUM("new", "used"),
                defaultValue: "new",
                allowNull: false,
            },
            weight: {
                type: DataTypes.INTEGER,
                allowNull: false, // in grams
                defaultValue: 0, // Add a default value
            },
            length: {
                type: DataTypes.INTEGER,
                allowNull: true, // in cm
            },
            width: {
                type: DataTypes.INTEGER,
                allowNull: true, // in cm
            },
            height: {
                type: DataTypes.INTEGER,
                allowNull: true, // in cm
            },
            dangerousProduct: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            preOrder: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            preorderDays: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            youtubeLink: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            promoImagePath: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            imagePaths: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            videoPath: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            variations: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            wholesale: {
                type: DataTypes.JSON,
                allowNull: true,
            },
            isPublished: {
                type: DataTypes.BOOLEAN,
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
