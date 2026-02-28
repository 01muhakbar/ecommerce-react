import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface AttributeAttributes {
  id: number;
  name: string;
  displayName?: string | null;
}

interface AttributeCreationAttributes extends Optional<AttributeAttributes, "id"> {}

export class Attribute extends Model<AttributeAttributes, AttributeCreationAttributes> implements AttributeAttributes {
  declare id: number;
  declare name: string;
  declare displayName: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

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
        displayName: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "display_name",
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
