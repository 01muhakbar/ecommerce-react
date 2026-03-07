import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface ProductAttributes {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  barcode?: string;
  gtin?: string;
  salePrice?: number;
  price: number;
  stock: number;
  userId: number;
  categoryId?: number;
  defaultCategoryId?: number | null;
  status: "active" | "inactive" | "draft";
  isPublished: boolean;
  description?: string;
  promoImagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  tags?: any;
  weight?: number;
  notes?: string;
  parentSku?: string;
  condition?: string;
  length?: number;
  width?: number;
  height?: number;
  dangerousProduct?: boolean;
  preOrder?: boolean;
  preorderDays?: number;
  youtubeLink?: string;
  variations?: any;
  wholesale?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProductCreationAttributes = Optional<
  ProductAttributes,
  "id" | "sku" | "status" | "categoryId" | "description" | "barcode" | "gtin"
>;

class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  declare id: number;
  declare name: string;
  declare slug: string;
  declare sku: string | null;
  declare barcode?: string;
  declare gtin?: string;
  declare salePrice?: number;
  declare price: number;
  declare stock: number;
  declare userId: number;
  declare categoryId?: number;
  declare defaultCategoryId?: number | null;
  declare status: "active" | "inactive" | "draft";
  declare isPublished: boolean;
  declare description?: string;
  declare promoImagePath?: string;
  declare imagePaths?: string[];
  declare videoPath?: string;
  declare tags?: any;
  declare weight?: number;
  declare notes?: string;
  declare parentSku?: string;
  declare condition?: string;
  declare length?: number;
  declare width?: number;
  declare height?: number;
  declare dangerousProduct?: boolean;
  declare preOrder?: boolean;
  declare preorderDays?: number;
  declare youtubeLink?: string;
  declare variations?: any;
  declare wholesale?: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    // Define associations here
    Product.belongsTo(models.Category, {
      foreignKey: "categoryId",
      as: "category",
    });
    Product.belongsTo(models.Category, {
      foreignKey: "defaultCategoryId",
      as: "defaultCategory",
    });
    Product.belongsToMany(models.Category, {
      through: models.ProductCategory,
      foreignKey: "productId",
      otherKey: "categoryId",
      as: "categories",
    });
    Product.belongsTo(models.User, {
      foreignKey: "userId",
      as: "seller",
    });
  }

  static initModel(sequelize: Sequelize) {
    return Product.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          primaryKey: true,
          autoIncrement: true,
        },
        name: { type: DataTypes.STRING(255), allowNull: false },
        slug: { type: DataTypes.STRING(255), allowNull: false, unique: true },
        sku: { type: DataTypes.STRING(100), allowNull: true, unique: false },
        barcode: { type: DataTypes.STRING(100), allowNull: true },
        gtin: { type: DataTypes.STRING(100), allowNull: true },
        price: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        weight: { type: DataTypes.INTEGER, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        parentSku: { type: DataTypes.STRING(100), allowNull: true },
        condition: { type: DataTypes.STRING(50), allowNull: true },
        length: { type: DataTypes.INTEGER, allowNull: true },
        width: { type: DataTypes.INTEGER, allowNull: true },
        height: { type: DataTypes.INTEGER, allowNull: true },
        dangerousProduct: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        },
        preOrder: {
          type: DataTypes.BOOLEAN,
          allowNull: true,
          defaultValue: false,
        },
        preorderDays: { type: DataTypes.INTEGER, allowNull: true },
        youtubeLink: { type: DataTypes.STRING(255), allowNull: true },
        variations: { type: DataTypes.JSON, allowNull: true },
        wholesale: { type: DataTypes.JSON, allowNull: true },
        promoImagePath: { type: DataTypes.STRING(255), allowNull: true },
        imagePaths: { type: DataTypes.JSON, allowNull: true },
        videoPath: { type: DataTypes.STRING(255), allowNull: true },
        tags: { type: DataTypes.JSON, allowNull: true },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
        },
        categoryId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "categories",
            key: "id",
          },
        },
        defaultCategoryId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "categories",
            key: "id",
          },
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        salePrice: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
        },
        status: {
          type: DataTypes.ENUM("active", "inactive", "draft"),
          allowNull: false,
          defaultValue: "draft",
        },
        isPublished: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "published",
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: "created_at",
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: "updated_at",
        },
      },
      {
        sequelize,
        modelName: "Product",
        tableName: "products",
        underscored: true,
      }
    );
  }
}

export { Product };
