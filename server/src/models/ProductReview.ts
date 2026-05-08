import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface ProductReviewAttributes {
  id: number;
  userId: number;
  productId: number;
  rating: number;
  comment?: string | null;
  images?: string[] | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ProductReviewCreationAttributes = Optional<ProductReviewAttributes, "id">;

export class ProductReview
  extends Model<ProductReviewAttributes, ProductReviewCreationAttributes>
  implements ProductReviewAttributes
{
  declare id: number;
  declare userId: number;
  declare productId: number;
  declare rating: number;
  declare comment?: string | null;
  declare images?: string[] | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    ProductReview.belongsTo(models.User, {
      foreignKey: { name: "userId", field: "user_id" },
      as: "user",
    });
    ProductReview.belongsTo(models.Product, {
      foreignKey: { name: "productId", field: "product_id" },
      as: "product",
    });
  }

  static initModel(sequelize: Sequelize): typeof ProductReview {
    ProductReview.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: "users", key: "id" },
          field: "user_id",
        },
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: "products", key: "id" },
          field: "product_id",
        },
        rating: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        comment: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        images: {
          type: DataTypes.JSON,
          allowNull: true,
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
        modelName: "ProductReview",
        tableName: "product_reviews",
        underscored: true,
        indexes: [
          {
            unique: true,
            fields: ["user_id", "product_id"],
          },
        ],
      }
    );
    return ProductReview;
  }
}
