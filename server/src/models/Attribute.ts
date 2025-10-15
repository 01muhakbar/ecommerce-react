import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface AttributeAttributes {
  id: number;
  name: string;
}

interface AttributeCreationAttributes extends Optional<AttributeAttributes, "id"> {}

export class Attribute extends Model<AttributeAttributes, AttributeCreationAttributes> implements AttributeAttributes {
  public id!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Attribute {
    Attribute.init(
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
      },
      {
        sequelize,
        modelName: "Attribute",
        tableName: "attributes",
        underscored: true,
      }
    );
    return Attribute;
  }
}