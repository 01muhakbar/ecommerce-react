import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface TrackingEventAttributes {
  id: number;
  shipmentId: number;
  eventType: string;
  eventLabel?: string | null;
  eventDescription?: string | null;
  occurredAt?: Date | null;
  source?: string | null;
  actorType?: string | null;
  actorId?: number | null;
  metadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type TrackingEventCreationAttributes = Optional<
  TrackingEventAttributes,
  | "id"
  | "eventLabel"
  | "eventDescription"
  | "occurredAt"
  | "source"
  | "actorType"
  | "actorId"
  | "metadata"
>;

export class TrackingEvent
  extends Model<TrackingEventAttributes, TrackingEventCreationAttributes>
  implements TrackingEventAttributes
{
  declare id: number;
  declare shipmentId: number;
  declare eventType: string;
  declare eventLabel?: string | null;
  declare eventDescription?: string | null;
  declare occurredAt?: Date | null;
  declare source?: string | null;
  declare actorType?: string | null;
  declare actorId?: number | null;
  declare metadata?: Record<string, any> | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    TrackingEvent.belongsTo(models.Shipment, {
      foreignKey: { name: "shipmentId", field: "shipment_id" },
      as: "shipment",
    });
  }

  static initModel(sequelize: Sequelize) {
    return TrackingEvent.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        shipmentId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "shipment_id",
          references: {
            model: "shipments",
            key: "id",
          },
        },
        eventType: {
          type: DataTypes.STRING(64),
          allowNull: false,
          field: "event_type",
        },
        eventLabel: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: "event_label",
        },
        eventDescription: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "event_description",
        },
        occurredAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "occurred_at",
        },
        source: {
          type: DataTypes.STRING(64),
          allowNull: true,
        },
        actorType: {
          type: DataTypes.STRING(64),
          allowNull: true,
          field: "actor_type",
        },
        actorId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "actor_id",
        },
        metadata: {
          type: DataTypes.JSON,
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
        modelName: "TrackingEvent",
        tableName: "tracking_events",
        underscored: true,
        indexes: [
          { fields: ["shipment_id"], name: "tracking_events_shipment_id_idx" },
          { fields: ["occurred_at"], name: "tracking_events_occurred_at_idx" },
          { fields: ["event_type"], name: "tracking_events_event_type_idx" },
        ],
      }
    );
  }
}
