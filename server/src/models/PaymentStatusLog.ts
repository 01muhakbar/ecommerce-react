import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface PaymentStatusLogAttributes {
  id: number;
  paymentId: number;
  oldStatus?: string | null;
  newStatus: string;
  actorType: "SYSTEM" | "BUYER" | "SELLER" | "ADMIN" | "WEBHOOK";
  actorId?: number | null;
  note?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PaymentStatusLogCreationAttributes = Optional<
  PaymentStatusLogAttributes,
  "id" | "oldStatus" | "actorId" | "note"
>;

export class PaymentStatusLog
  extends Model<PaymentStatusLogAttributes, PaymentStatusLogCreationAttributes>
  implements PaymentStatusLogAttributes
{
  declare id: number;
  declare paymentId: number;
  declare oldStatus?: string | null;
  declare newStatus: string;
  declare actorType: "SYSTEM" | "BUYER" | "SELLER" | "ADMIN" | "WEBHOOK";
  declare actorId?: number | null;
  declare note?: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    PaymentStatusLog.belongsTo(models.Payment, {
      foreignKey: { name: "paymentId", field: "payment_id" },
      as: "payment",
    });
    PaymentStatusLog.belongsTo(models.User, {
      foreignKey: { name: "actorId", field: "actor_id" },
      as: "actorUser",
    });
  }

  static initModel(sequelize: Sequelize) {
    return PaymentStatusLog.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        paymentId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "payment_id",
          references: {
            model: "payments",
            key: "id",
          },
        },
        oldStatus: {
          type: DataTypes.STRING(80),
          allowNull: true,
          field: "old_status",
        },
        newStatus: {
          type: DataTypes.STRING(80),
          allowNull: false,
          field: "new_status",
        },
        actorType: {
          type: DataTypes.ENUM("SYSTEM", "BUYER", "SELLER", "ADMIN", "WEBHOOK"),
          allowNull: false,
          field: "actor_type",
        },
        actorId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "actor_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
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
        modelName: "PaymentStatusLog",
        tableName: "payment_status_logs",
        underscored: true,
      }
    );
  }
}
