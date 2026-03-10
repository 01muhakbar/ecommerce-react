import {
  Model,
  DataTypes,
  Sequelize,
  BelongsToManyGetAssociationsMixin,
  BelongsToGetAssociationMixin,
  Optional,
} from "sequelize";
import { Product } from "./Product.js";
import { User } from "./User.js";

export interface OrderAttributes {
  id: number;
  invoiceNo: string;
  userId: number;
  checkoutMode?: "LEGACY" | "SINGLE_STORE" | "MULTI_STORE" | null;
  subtotalAmount?: number | null;
  shippingAmount?: number | null;
  serviceFeeAmount?: number | null;
  paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "PAID" | null;
  shippingDetails?: {
    fullName: string;
    phoneNumber: string;
    province: string;
    city: string;
    district: string;
    postalCode: string;
    streetName: string;
    building?: string | null;
    houseNumber: string;
    otherDetails?: string | null;
    markAs?: "HOME" | "OFFICE";
  } | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  customerNotes?: string | null;
  paymentMethod?: string | null;
  couponCode?: string | null;
  discountAmount?: number | null;
  totalAmount: number;
  status:
    | "pending"
    | "paid"
    | "processing"
    | "shipped"
    | "delivered"
    | "completed"
    | "cancelled";
  createdAt?: Date;
  updatedAt?: Date;
}

interface OrderCreationAttributes extends Optional<OrderAttributes, "id"> {}

export class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  declare id: number;
  declare invoiceNo: string;
  declare userId: number;
  declare checkoutMode?: "LEGACY" | "SINGLE_STORE" | "MULTI_STORE" | null;
  declare subtotalAmount?: number | null;
  declare shippingAmount?: number | null;
  declare serviceFeeAmount?: number | null;
  declare paymentStatus?: "UNPAID" | "PARTIALLY_PAID" | "PAID" | null;
  declare shippingDetails?: {
    fullName: string;
    phoneNumber: string;
    province: string;
    city: string;
    district: string;
    postalCode: string;
    streetName: string;
    building?: string | null;
    houseNumber: string;
    otherDetails?: string | null;
    markAs?: "HOME" | "OFFICE";
  } | null;
  declare customerName?: string | null;
  declare customerPhone?: string | null;
  declare customerAddress?: string | null;
  declare customerNotes?: string | null;
  declare paymentMethod?: string | null;
  declare couponCode?: string | null;
  declare discountAmount?: number | null;
  declare totalAmount: number;
  declare status:
    | "pending"
    | "paid"
    | "processing"
    | "shipped"
    | "delivered"
    | "completed"
    | "cancelled";

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  declare getProducts: BelongsToManyGetAssociationsMixin<Product>;
  declare getUser: BelongsToGetAssociationMixin<User>;

  declare readonly user?: User;
  declare readonly products?: Product[];

  public static associate(models: any) {
    Order.belongsTo(models.User, {
      foreignKey: { name: "userId", field: "user_id" },
      as: "customer", // Using 'customer' as alias for User in Order context
    });
    Order.hasMany(models.OrderItem, {
      foreignKey: { name: "orderId", field: "order_id" },
      as: "items",
    });
    Order.hasMany(models.Suborder, {
      foreignKey: { name: "orderId", field: "order_id" },
      as: "suborders",
    });
  }
  static initModel(sequelize: Sequelize): typeof Order {
    Order.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        invoiceNo: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: { model: "Users", key: "id" },
        },
        checkoutMode: {
          type: DataTypes.ENUM("LEGACY", "SINGLE_STORE", "MULTI_STORE"),
          allowNull: true,
          defaultValue: "LEGACY",
          field: "checkout_mode",
        },
        subtotalAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0,
          field: "subtotal_amount",
        },
        shippingAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0,
          field: "shipping_amount",
        },
        serviceFeeAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          defaultValue: 0,
          field: "service_fee_amount",
        },
        paymentStatus: {
          type: DataTypes.ENUM("UNPAID", "PARTIALLY_PAID", "PAID"),
          allowNull: true,
          defaultValue: "UNPAID",
          field: "payment_status",
        },
        shippingDetails: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "shipping_details",
        },
        customerName: {
          type: DataTypes.STRING(120),
          allowNull: true,
          field: "customer_name",
        },
        customerPhone: {
          type: DataTypes.STRING(30),
          allowNull: true,
          field: "customer_phone",
        },
        customerAddress: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "customer_address",
        },
        customerNotes: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "customer_notes",
        },
        paymentMethod: {
          type: DataTypes.STRING(30),
          allowNull: true,
          field: "payment_method",
        },
        couponCode: {
          type: DataTypes.STRING(50),
          allowNull: true,
          field: "coupon_code",
        },
        discountAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: true,
          field: "discount_amount",
        },
        totalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM(
            "pending",
            "paid",
            "processing",
            "shipped",
            "delivered",
            "completed",
            "cancelled"
          ),
          defaultValue: "pending",
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: "Order",
        tableName: "Orders",
        underscored: true,
      }
    );
    return Order;
  }
}
