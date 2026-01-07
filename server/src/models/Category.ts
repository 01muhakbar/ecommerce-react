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
  public id!: number;
  public code!: string;
  public name!: string;
  public description?: string;
  public icon?: string;
  public published!: boolean;
  public parentId?: number | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(_models: any) {
    Category.hasMany(Category, { as: "children", foreignKey: "parent_id" });
    Category.belongsTo(Category, { as: "parent", foreignKey: "parent_id" });
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
