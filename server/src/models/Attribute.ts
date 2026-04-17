import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface AttributeAttributes {
  id: number;
  name: string;
  displayName?: string | null;
  type: "dropdown" | "radio" | "checkbox";
  published: boolean;
}

interface AttributeCreationAttributes extends Optional<AttributeAttributes, "id"> {}

export class Attribute extends Model<AttributeAttributes, AttributeCreationAttributes> implements AttributeAttributes {
  declare id: number;
  declare name: string;
  declare displayName: string | null;
  declare type: "dropdown" | "radio" | "checkbox";
  declare published: boolean;

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
        type: {
          type: DataTypes.ENUM("dropdown", "radio", "checkbox"),
          allowNull: false,
          defaultValue: "dropdown",
        },
        published: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
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
