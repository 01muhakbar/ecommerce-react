import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StoreAuditLogAttributes {
  id: number;
  storeId: number;
  actorUserId?: number | null;
  targetUserId?: number | null;
  targetMemberId?: number | null;
  action: string;
  beforeState?: string | null;
  afterState?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StoreAuditLogCreationAttributes = Optional<
  StoreAuditLogAttributes,
  "id" | "actorUserId" | "targetUserId" | "targetMemberId" | "beforeState" | "afterState"
>;

export class StoreAuditLog
  extends Model<StoreAuditLogAttributes, StoreAuditLogCreationAttributes>
  implements StoreAuditLogAttributes
{
  declare id: number;
  declare storeId: number;
  declare actorUserId?: number | null;
  declare targetUserId?: number | null;
  declare targetMemberId?: number | null;
  declare action: string;
  declare beforeState?: string | null;
  declare afterState?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    models.Store.hasMany(StoreAuditLog, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "auditLogs",
    });

    StoreAuditLog.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
    StoreAuditLog.belongsTo(models.User, {
      foreignKey: { name: "actorUserId", field: "actor_user_id" },
      as: "actorUser",
    });
    StoreAuditLog.belongsTo(models.User, {
      foreignKey: { name: "targetUserId", field: "target_user_id" },
      as: "targetUser",
    });
    StoreAuditLog.belongsTo(models.StoreMember, {
      foreignKey: { name: "targetMemberId", field: "target_member_id" },
      as: "targetMember",
    });
  }

  static initModel(sequelize: Sequelize) {
    return StoreAuditLog.init(
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
        actorUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "actor_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        targetUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "target_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        targetMemberId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "target_member_id",
          references: {
            model: "store_members",
            key: "id",
          },
        },
        action: {
          type: DataTypes.STRING(80),
          allowNull: false,
        },
        beforeState: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "before_state",
        },
        afterState: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "after_state",
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
        modelName: "StoreAuditLog",
        tableName: "store_audit_logs",
        underscored: true,
      }
    );
  }
}
