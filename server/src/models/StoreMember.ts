import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StoreMemberAttributes {
  id: number;
  storeId: number;
  userId: number;
  storeRoleId: number;
  status: "INVITED" | "ACTIVE" | "DISABLED" | "REMOVED";
  invitedByUserId?: number | null;
  invitedAt?: Date | null;
  acceptedAt?: Date | null;
  disabledAt?: Date | null;
  disabledByUserId?: number | null;
  removedAt?: Date | null;
  removedByUserId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StoreMemberCreationAttributes = Optional<
  StoreMemberAttributes,
  "id" | "status"
>;

export class StoreMember
  extends Model<StoreMemberAttributes, StoreMemberCreationAttributes>
  implements StoreMemberAttributes
{
  declare id: number;
  declare storeId: number;
  declare userId: number;
  declare storeRoleId: number;
  declare status: "INVITED" | "ACTIVE" | "DISABLED" | "REMOVED";
  declare invitedByUserId?: number | null;
  declare invitedAt?: Date | null;
  declare acceptedAt?: Date | null;
  declare disabledAt?: Date | null;
  declare disabledByUserId?: number | null;
  declare removedAt?: Date | null;
  declare removedByUserId?: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    models.Store.hasMany(StoreMember, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "members",
    });
    models.User.hasMany(StoreMember, {
      foreignKey: { name: "userId", field: "user_id" },
      as: "storeMemberships",
    });
    models.User.hasMany(StoreMember, {
      foreignKey: { name: "invitedByUserId", field: "invited_by_user_id" },
      as: "sentStoreInvitations",
    });
    models.User.hasMany(StoreMember, {
      foreignKey: { name: "disabledByUserId", field: "disabled_by_user_id" },
      as: "disabledStoreMemberships",
    });
    models.User.hasMany(StoreMember, {
      foreignKey: { name: "removedByUserId", field: "removed_by_user_id" },
      as: "removedStoreMemberships",
    });

    StoreMember.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
    StoreMember.belongsTo(models.User, {
      foreignKey: { name: "userId", field: "user_id" },
      as: "user",
    });
    StoreMember.belongsTo(models.StoreRole, {
      foreignKey: { name: "storeRoleId", field: "store_role_id" },
      as: "role",
    });
    StoreMember.belongsTo(models.User, {
      foreignKey: { name: "invitedByUserId", field: "invited_by_user_id" },
      as: "invitedByUser",
    });
    StoreMember.belongsTo(models.User, {
      foreignKey: { name: "disabledByUserId", field: "disabled_by_user_id" },
      as: "disabledByUser",
    });
    StoreMember.belongsTo(models.User, {
      foreignKey: { name: "removedByUserId", field: "removed_by_user_id" },
      as: "removedByUser",
    });
  }

  static initModel(sequelize: Sequelize) {
    return StoreMember.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        storeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "store_id",
          references: {
            model: "stores",
            key: "id",
          },
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        storeRoleId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "store_role_id",
          references: {
            model: "store_roles",
            key: "id",
          },
        },
        status: {
          type: DataTypes.ENUM("INVITED", "ACTIVE", "DISABLED", "REMOVED"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
        invitedByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "invited_by_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        invitedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "invited_at",
        },
        acceptedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "accepted_at",
        },
        disabledAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "disabled_at",
        },
        disabledByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "disabled_by_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        removedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "removed_at",
        },
        removedByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "removed_by_user_id",
          references: {
            model: "users",
            key: "id",
          },
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
        modelName: "StoreMember",
        tableName: "store_members",
        underscored: true,
        indexes: [
          {
            unique: true,
            name: "uq_store_members_store_user",
            fields: ["store_id", "user_id"],
          },
          {
            name: "idx_store_members_user_id",
            fields: ["user_id"],
          },
          {
            name: "idx_store_members_store_role_id",
            fields: ["store_role_id"],
          },
          {
            name: "idx_store_members_invited_by_user_id",
            fields: ["invited_by_user_id"],
          },
          {
            name: "idx_store_members_disabled_by_user_id",
            fields: ["disabled_by_user_id"],
          },
          {
            name: "idx_store_members_removed_by_user_id",
            fields: ["removed_by_user_id"],
          },
        ],
      }
    );
  }
}
