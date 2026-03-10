import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StoreAttributes {
  id: number;
  ownerUserId: number;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt?: Date;
  updatedAt?: Date;
}

type StoreCreationAttributes = Optional<StoreAttributes, "id" | "status">;

export class Store
  extends Model<StoreAttributes, StoreCreationAttributes>
  implements StoreAttributes
{
  declare id: number;
  declare ownerUserId: number;
  declare name: string;
  declare slug: string;
  declare status: "ACTIVE" | "INACTIVE";
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    models.User.hasOne(Store, {
      foreignKey: { name: "ownerUserId", field: "owner_user_id" },
      as: "store",
    });
    Store.belongsTo(models.User, {
      foreignKey: { name: "ownerUserId", field: "owner_user_id" },
      as: "owner",
    });
    Store.hasOne(models.StorePaymentProfile, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "paymentProfile",
    });
    Store.hasMany(models.Suborder, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "suborders",
    });
    Store.hasMany(models.Payment, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "payments",
    });
    Store.hasMany(models.Product, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "products",
    });
  }

  static initModel(sequelize: Sequelize) {
    return Store.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        ownerUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          field: "owner_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        name: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        slug: {
          type: DataTypes.STRING(180),
          allowNull: false,
          unique: true,
        },
        status: {
          type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
          allowNull: false,
          defaultValue: "ACTIVE",
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
        modelName: "Store",
        tableName: "stores",
        underscored: true,
      }
    );
  }
}
