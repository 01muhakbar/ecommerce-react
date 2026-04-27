import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface AttributeAttributes {
  id: number;
  name: string;
  displayName?: string | null;
  type: "dropdown" | "radio" | "checkbox";
  published: boolean;
  scope: "global" | "store";
  storeId?: number | null;
  createdByRole: "admin" | "seller";
  createdByUserId?: number | null;
  status: "active" | "archived";
}

interface AttributeCreationAttributes extends Optional<AttributeAttributes, "id"> {}

export class Attribute extends Model<AttributeAttributes, AttributeCreationAttributes> implements AttributeAttributes {
  declare id: number;
  declare name: string;
  declare displayName: string | null;
  declare type: "dropdown" | "radio" | "checkbox";
  declare published: boolean;
  declare scope: "global" | "store";
  declare storeId: number | null;
  declare createdByRole: "admin" | "seller";
  declare createdByUserId: number | null;
  declare status: "active" | "archived";

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
        scope: {
          type: DataTypes.ENUM("global", "store"),
          allowNull: false,
          defaultValue: "global",
        },
        storeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "store_id",
        },
        createdByRole: {
          type: DataTypes.ENUM("admin", "seller"),
          allowNull: false,
          defaultValue: "admin",
          field: "created_by_role",
        },
        createdByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "created_by_user_id",
        },
        status: {
          type: DataTypes.ENUM("active", "archived"),
          allowNull: false,
          defaultValue: "active",
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
