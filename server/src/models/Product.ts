import { DataTypes, Model, Sequelize, Optional } from "sequelize";

// Antarmuka untuk atribut produk, agar sesuai dengan database
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

// Atribut yang bersifat opsional saat pembuatan produk (misalnya 'id')
interface ProductCreationAttributes
  extends Optional<
    ProductAttributes,
    "id" | "stock" | "status" | "condition" | "dangerousProduct" | "preOrder"
  > {}

export class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
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
      },
      {
        sequelize,
        modelName: "Product",
        tableName: "Products", // Eksplisit nama tabel
      }
    );
    return Product;
  }
}
