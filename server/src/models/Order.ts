import { DataTypes, Model, Optional, Sequelize } from "sequelize";

interface OrderAttributes {
  id: number;
  userId: number;
  totalAmount: number;
  status: "pending" | "completed" | "cancelled";
  createdAt?: Date;
  updatedAt?: Date;
}

interface OrderCreationAttributes
  extends Optional<OrderAttributes, "id" | "status"> {}

export class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  public id!: number;
  public userId!: number;
  public totalAmount!: number;
  public status!: "pending" | "completed" | "cancelled";

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    Order.belongsTo(models.User, { foreignKey: "userId" });

    Order.belongsToMany(models.Product, {
      through: models.OrderItem,
      foreignKey: "orderId",
      otherKey: "productId",
      as: "products", // Tambahkan alias yang sesuai
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
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        totalAmount: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        status: {
          type: DataTypes.STRING,
          allowNull: false,
          defaultValue: "pending",
          validate: {
            isIn: [["pending", "completed", "cancelled"]],
          },
        },
      },
      {
        sequelize,
        modelName: "Order",
      }
    );
    return Order;
  }
}
