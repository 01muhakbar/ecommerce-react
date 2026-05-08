import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface ShipmentAttributes {
  id: number;
  orderId: number;
  suborderId: number;
  storeId: number;
  sellerUserId?: number | null;
  status:
    | "WAITING_PAYMENT"
    | "READY_TO_FULFILL"
    | "PROCESSING"
    | "PACKED"
    | "SHIPPED"
    | "IN_TRANSIT"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FAILED_DELIVERY"
    | "RETURNED"
    | "CANCELLED";
  courierCode?: string | null;
  courierService?: string | null;
  trackingNumber?: string | null;
  estimatedDelivery?: Date | null;
  shippingFee: number;
  shippingAddressSnapshot?: Record<string, any> | null;
  shippingRateSnapshot?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type ShipmentCreationAttributes = Optional<
  ShipmentAttributes,
  | "id"
  | "sellerUserId"
  | "status"
  | "courierCode"
  | "courierService"
  | "trackingNumber"
  | "estimatedDelivery"
  | "shippingAddressSnapshot"
  | "shippingRateSnapshot"
>;

export class Shipment
  extends Model<ShipmentAttributes, ShipmentCreationAttributes>
  implements ShipmentAttributes
{
  declare id: number;
  declare orderId: number;
  declare suborderId: number;
  declare storeId: number;
  declare sellerUserId?: number | null;
  declare status:
    | "WAITING_PAYMENT"
    | "READY_TO_FULFILL"
    | "PROCESSING"
    | "PACKED"
    | "SHIPPED"
    | "IN_TRANSIT"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "FAILED_DELIVERY"
    | "RETURNED"
    | "CANCELLED";
  declare courierCode?: string | null;
  declare courierService?: string | null;
  declare trackingNumber?: string | null;
  declare estimatedDelivery?: Date | null;
  declare shippingFee: number;
  declare shippingAddressSnapshot?: Record<string, any> | null;
  declare shippingRateSnapshot?: Record<string, any> | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    Shipment.belongsTo(models.Order, {
      foreignKey: { name: "orderId", field: "order_id" },
      as: "order",
    });
    Shipment.belongsTo(models.Suborder, {
      foreignKey: { name: "suborderId", field: "suborder_id" },
      as: "suborder",
    });
    Shipment.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
    Shipment.belongsTo(models.User, {
      foreignKey: { name: "sellerUserId", field: "seller_user_id" },
      as: "seller",
    });
    Shipment.hasMany(models.TrackingEvent, {
      foreignKey: { name: "shipmentId", field: "shipment_id" },
      as: "trackingEvents",
    });
  }

  static initModel(sequelize: Sequelize) {
    return Shipment.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        orderId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "order_id",
          references: {
            model: "Orders",
            key: "id",
          },
        },
        suborderId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          field: "suborder_id",
          references: {
            model: "suborders",
            key: "id",
          },
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
        sellerUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "seller_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        status: {
          type: DataTypes.ENUM(
            "WAITING_PAYMENT",
            "READY_TO_FULFILL",
            "PROCESSING",
            "PACKED",
            "SHIPPED",
            "IN_TRANSIT",
            "OUT_FOR_DELIVERY",
            "DELIVERED",
            "FAILED_DELIVERY",
            "RETURNED",
            "CANCELLED"
          ),
          allowNull: false,
          defaultValue: "WAITING_PAYMENT",
        },
        courierCode: {
          type: DataTypes.STRING(64),
          allowNull: true,
          field: "courier_code",
        },
        courierService: {
          type: DataTypes.STRING(120),
          allowNull: true,
          field: "courier_service",
        },
        trackingNumber: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: "tracking_number",
        },
        estimatedDelivery: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "estimated_delivery",
        },
        shippingFee: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          field: "shipping_fee",
        },
        shippingAddressSnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "shipping_address_snapshot",
        },
        shippingRateSnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "shipping_rate_snapshot",
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
        modelName: "Shipment",
        tableName: "shipments",
        underscored: true,
        indexes: [
          { unique: true, fields: ["suborder_id"], name: "shipments_suborder_id_unique" },
          { fields: ["order_id"], name: "shipments_order_id_idx" },
          { fields: ["store_id"], name: "shipments_store_id_idx" },
          { fields: ["seller_user_id"], name: "shipments_seller_user_id_idx" },
          { fields: ["status"], name: "shipments_status_idx" },
        ],
      }
    );
  }
}
