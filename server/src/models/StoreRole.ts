import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StoreRoleAttributes {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type StoreRoleCreationAttributes = Optional<
  StoreRoleAttributes,
  "id" | "description" | "isSystem" | "isActive"
>;

export class StoreRole
  extends Model<StoreRoleAttributes, StoreRoleCreationAttributes>
  implements StoreRoleAttributes
{
  declare id: number;
  declare code: string;
  declare name: string;
  declare description?: string | null;
  declare isSystem: boolean;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    StoreRole.hasMany(models.StoreMember, {
      foreignKey: { name: "storeRoleId", field: "store_role_id" },
      as: "members",
    });
  }

  static initModel(sequelize: Sequelize) {
    return StoreRole.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        code: {
          type: DataTypes.STRING(64),
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
        isSystem: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: "is_system",
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
          field: "is_active",
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
        modelName: "StoreRole",
        tableName: "store_roles",
        underscored: true,
      }
    );
  }
}
