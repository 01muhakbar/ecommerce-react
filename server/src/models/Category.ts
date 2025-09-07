import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CategoryAttributes {
  id: number;
  name: string;
  description?: string;
}

interface CategoryCreationAttributes
  extends Optional<CategoryAttributes, "id"> {}

export class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  public id!: number;
  public name!: string;
  public description?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    Category.hasMany(models.Product, { foreignKey: "categoryId" });
  }

  static initModel(sequelize: Sequelize): typeof Category {
    Category.init(
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
      },
      {
        sequelize,
        modelName: "Category",
      }
    );
    return Category;
  }
}
