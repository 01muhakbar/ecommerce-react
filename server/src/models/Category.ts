import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CategoryAttributes {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  published: boolean;
  parentId?: number | null;
}

interface CategoryCreationAttributes
  extends Optional<CategoryAttributes, "id"> {}

export class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  declare id: number;
  declare code: string;
  declare name: string;
  declare description?: string;
  declare icon?: string;
  declare published: boolean;
  declare parentId?: number | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(_models: any) {
    const models = _models;
    Category.hasMany(Category, { as: "children", foreignKey: "parentId" });
    Category.belongsTo(Category, { as: "parent", foreignKey: "parentId" });
    Category.hasMany(models.Product, { as: "products", foreignKey: "categoryId" });
    Category.hasMany(models.Product, { as: "defaultProducts", foreignKey: "defaultCategoryId" });
    Category.belongsToMany(models.Product, {
      through: models.ProductCategory,
      foreignKey: "categoryId",
      otherKey: "productId",
      as: "relatedProducts",
    });
  }

  static initModel(sequelize: Sequelize): typeof Category {
    Category.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        code: {
          type: DataTypes.STRING(32),
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        description: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        icon: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        published: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
        parentId: {
          field: "parent_id",
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "Category",
        tableName: "Categories",
        underscored: true,
      }
    );
    return Category;
  }
}
