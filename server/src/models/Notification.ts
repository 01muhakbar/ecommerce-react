import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface NotificationAttributes {
  id: number;
  type: string;
  title: string;
  isRead: boolean;
  meta?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  "id" | "isRead" | "meta"
>;

export class Notification
  extends Model<NotificationAttributes, NotificationCreationAttributes>
  implements NotificationAttributes
{
  declare id: number;
  declare type: string;
  declare title: string;
  declare isRead: boolean;
  declare meta?: Record<string, any> | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Notification {
    Notification.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        type: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        isRead: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "is_read",
        },
        meta: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "Notification",
        tableName: "notifications",
        underscored: true,
      }
    );
    return Notification;
  }
}
