import { DataTypes, Model, Sequelize } from "sequelize";

interface ProductCategoryAttributes {
  productId: number;
  categoryId: number;
}

export class ProductCategory
  extends Model<ProductCategoryAttributes>
  implements ProductCategoryAttributes
{
  declare productId: number;
  declare categoryId: number;

  static associate() {
    return undefined;
  }

  static initModel(sequelize: Sequelize): typeof ProductCategory {
    ProductCategory.init(
      {
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
          field: "product_id",
          references: {
            model: "products",
            key: "id",
          },
        },
        categoryId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          primaryKey: true,
          field: "category_id",
          references: {
            model: "Categories",
            key: "id",
          },
        },
      },
      {
        sequelize,
        modelName: "ProductCategory",
        tableName: "product_categories",
        timestamps: false,
        underscored: true,
      }
    );
    return ProductCategory;
  }
}
