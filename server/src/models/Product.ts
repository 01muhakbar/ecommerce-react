import { DataTypes, Model, Sequelize, Optional } from "sequelize";

// ... (Interface tetap sama)
interface ProductAttributes {
  id: number;
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  stock: number;
  slug: string;
  tags?: string[];
  categoryId?: number;
  userId: number;
  status: "active" | "archived" | "draft";
  gtin?: string;
  notes?: string;
  parentSku?: string;
  sku?: string;
  barcode?: string;
  condition: "new" | "used";
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  dangerousProduct: boolean;
  preOrder: boolean;
  preorderDays?: number;
  youtubeLink?: string;
  promoImagePath?: string;
  imagePaths?: string[];
  videoPath?: string;
  isPublished: boolean;
  variations?: object;
  wholesale?: object;
}

interface ProductCreationAttributes
  extends Optional<
    ProductAttributes,
    "id" | "stock" | "status" | "condition" | "dangerousProduct" | "preOrder"
  > {}

export class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  // ... (Atribut publik tetap sama)
  public id!: number;
  public name!: string;
  public description?: string;
  public price!: number;
  public salePrice?: number;
  public stock!: number;
  public slug!: string;
  public tags?: string[];
  public categoryId?: number;
  public userId!: number;
  public status!: "active" | "archived" | "draft";
  public gtin?: string;
  public notes?: string;
  public parentSku?: string;
  public sku!: string;
  public barcode?: string;
  public condition!: "new" | "used";
  public weight!: number;
  public length?: number;
  public width?: number;
  public height?: number;
  public dangerousProduct!: boolean;
  public preOrder!: boolean;
  public preorderDays?: number;
  public youtubeLink?: string;
  public promoImagePath?: string;
  public imagePaths?: string[];
  public videoPath?: string;
  public isPublished!: boolean;
  public variations?: object;
  public wholesale?: object;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    Product.belongsTo(models.User, {
      foreignKey: "userId", // Explicitly set the foreign key
      as: "seller",
    });
    Product.belongsTo(models.Category, {
      foreignKey: "categoryId",
      as: "category",
    });
    Product.belongsToMany(models.Cart, {
      through: models.CartItem,
      foreignKey: "productId", // GUNAKAN camelCase agar konsisten
    });
  }

  static initModel(sequelize: Sequelize): typeof Product {
    Product.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
          field: "product_name",
        },
        description: { type: DataTypes.TEXT, allowNull: true },
        price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        salePrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
        stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        slug: { type: DataTypes.STRING, allowNull: false, unique: true },
        tags: { type: DataTypes.JSON, allowNull: true },
        categoryId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "category_id",
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "user_id",
          references: { model: "Users", key: "id" },
        },
        status: {
          type: DataTypes.ENUM("active", "archived", "draft"),
          defaultValue: "draft",
          allowNull: false,
        },
        gtin: { type: DataTypes.STRING, allowNull: true },
        notes: { type: DataTypes.TEXT, allowNull: true },
        parentSku: { type: DataTypes.STRING, allowNull: true },
        sku: { type: DataTypes.STRING, allowNull: true },
        barcode: { type: DataTypes.STRING, allowNull: true },
        condition: {
          type: DataTypes.ENUM("new", "used"),
          defaultValue: "new",
          allowNull: false,
        },
        weight: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        length: { type: DataTypes.INTEGER, allowNull: true },
        width: { type: DataTypes.INTEGER, allowNull: true },
        height: { type: DataTypes.INTEGER, allowNull: true },
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
        preorderDays: { type: DataTypes.INTEGER, allowNull: true },
        youtubeLink: { type: DataTypes.STRING, allowNull: true },
        promoImagePath: { type: DataTypes.STRING, allowNull: true },
        imagePaths: { type: DataTypes.JSON, allowNull: true },
        videoPath: { type: DataTypes.STRING, allowNull: true },
        isPublished: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        variations: { type: DataTypes.JSON, allowNull: true },
        wholesale: { type: DataTypes.JSON, allowNull: true },
      },
      {
        sequelize,
        modelName: "Product",
        tableName: "Products",
        underscored: true, // Diaktifkan kembali!
      }
    );
    return Product;
  }
}
