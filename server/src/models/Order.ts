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
  totalAmount: number;
  status: "pending" | "processing" | "shipped" | "completed" | "cancelled";
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
  public totalAmount!: number;
  public status!:
    | "pending"
    | "processing"
    | "shipped"
    | "completed"
    | "cancelled";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getProducts!: BelongsToManyGetAssociationsMixin<Product>;
  public getUser!: BelongsToGetAssociationMixin<User>;

  public readonly user?: User;
  public readonly products?: Product[];

  public static associate(models: any) {
    Order.belongsTo(models.User, { foreignKey: "userId", as: "user" });
    Order.belongsToMany(models.Product, {
      through: "OrderItem",
      as: "products",
    });
  }
  static initModel(sequelize: Sequelize): typeof Order {
    Order.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        invoiceNo: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Users", key: "id" },
        },
        totalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        status: {
          type: DataTypes.ENUM(
            "pending",
            "processing",
            "shipped",
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