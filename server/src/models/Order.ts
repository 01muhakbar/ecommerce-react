import {
  Model,
  DataTypes,
  Sequelize,
  BelongsToManyGetAssociationsMixin,
  BelongsToGetAssociationMixin,
  Optional,
} from "sequelize";
import { Product } from "./Product.ts";
import { User } from "./User.ts";

export interface OrderAttributes {
  id: number;
  invoiceNo: string;
  userId: number;
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
  public id!: number;
  public invoiceNo!: string;
  public userId!: number;
  public customerName?: string | null;
  public customerPhone?: string | null;
  public customerAddress?: string | null;
  public customerNotes?: string | null;
  public paymentMethod?: string | null;
  public couponCode?: string | null;
  public discountAmount?: number | null;
  public totalAmount!: number;
  public status!:
    | "pending"
    | "paid"
    | "processing"
    | "shipped"
    | "delivered"
    | "completed"
    | "cancelled";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getProducts!: BelongsToManyGetAssociationsMixin<Product>;
  public getUser!: BelongsToGetAssociationMixin<User>;

  public readonly user?: User;
  public readonly products?: Product[];

  public static associate(models: any) {
    Order.belongsTo(models.User, {
      foreignKey: { name: "userId", field: "user_id" },
      as: "customer", // Using 'customer' as alias for User in Order context
    });
    Order.hasMany(models.OrderItem, {
      foreignKey: { name: "orderId", field: "order_id" },
      as: "items",
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
