import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface SuborderAttributes {
  id: number;
  orderId: number;
  suborderNumber: string;
  storeId: number;
  storePaymentProfileId?: number | null;
  subtotalAmount: number;
  shippingAmount: number;
  serviceFeeAmount: number;
  totalAmount: number;
  paymentMethod: "QRIS";
  paymentStatus:
    | "UNPAID"
    | "PENDING_CONFIRMATION"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED";
  fulfillmentStatus:
    | "UNFULFILLED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
  expiresAt?: Date | null;
  paidAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type SuborderCreationAttributes = Optional<
  SuborderAttributes,
  | "id"
  | "storePaymentProfileId"
  | "shippingAmount"
  | "serviceFeeAmount"
  | "paymentMethod"
  | "paymentStatus"
  | "fulfillmentStatus"
  | "expiresAt"
  | "paidAt"
>;

export class Suborder
  extends Model<SuborderAttributes, SuborderCreationAttributes>
  implements SuborderAttributes
{
  declare id: number;
  declare orderId: number;
  declare suborderNumber: string;
  declare storeId: number;
  declare storePaymentProfileId?: number | null;
  declare subtotalAmount: number;
  declare shippingAmount: number;
  declare serviceFeeAmount: number;
  declare totalAmount: number;
  declare paymentMethod: "QRIS";
  declare paymentStatus:
    | "UNPAID"
    | "PENDING_CONFIRMATION"
    | "PAID"
    | "FAILED"
    | "EXPIRED"
    | "CANCELLED";
  declare fulfillmentStatus:
    | "UNFULFILLED"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED";
  declare expiresAt?: Date | null;
  declare paidAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    Suborder.belongsTo(models.Order, {
      foreignKey: { name: "orderId", field: "order_id" },
      as: "order",
    });
    Suborder.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
    Suborder.belongsTo(models.StorePaymentProfile, {
      foreignKey: { name: "storePaymentProfileId", field: "store_payment_profile_id" },
      as: "paymentProfile",
    });
    Suborder.hasMany(models.SuborderItem, {
      foreignKey: { name: "suborderId", field: "suborder_id" },
      as: "items",
    });
    Suborder.hasMany(models.Payment, {
      foreignKey: { name: "suborderId", field: "suborder_id" },
      as: "payments",
    });
  }

  static initModel(sequelize: Sequelize) {
    return Suborder.init(
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
        suborderNumber: {
          type: DataTypes.STRING(120),
          allowNull: false,
          unique: true,
          field: "suborder_number",
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
        storePaymentProfileId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "store_payment_profile_id",
          references: {
            model: "store_payment_profiles",
            key: "id",
          },
        },
        subtotalAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          field: "subtotal_amount",
        },
        shippingAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          field: "shipping_amount",
        },
        serviceFeeAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
          field: "service_fee_amount",
        },
        totalAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          field: "total_amount",
        },
        paymentMethod: {
          type: DataTypes.ENUM("QRIS"),
          allowNull: false,
          defaultValue: "QRIS",
          field: "payment_method",
        },
        paymentStatus: {
          type: DataTypes.ENUM(
            "UNPAID",
            "PENDING_CONFIRMATION",
            "PAID",
            "FAILED",
            "EXPIRED",
            "CANCELLED"
          ),
          allowNull: false,
          defaultValue: "UNPAID",
          field: "payment_status",
        },
        fulfillmentStatus: {
          type: DataTypes.ENUM(
            "UNFULFILLED",
            "PROCESSING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED"
          ),
          allowNull: false,
          defaultValue: "UNFULFILLED",
          field: "fulfillment_status",
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "expires_at",
        },
        paidAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "paid_at",
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
        modelName: "Suborder",
        tableName: "suborders",
        underscored: true,
      }
    );
  }
}
