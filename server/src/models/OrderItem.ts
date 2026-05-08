import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface OrderItemAttributes {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
  variantKey?: string | null;
  variantLabel?: string | null;
  variantSelections?: any;
  skuSnapshot?: string | null;
  barcodeSnapshot?: string | null;
  imageSnapshot?: string | null;
}

interface OrderItemCreationAttributes
  extends Optional<OrderItemAttributes, "id"> {}

export class OrderItem
  extends Model<OrderItemAttributes, OrderItemCreationAttributes>
  implements OrderItemAttributes
{
  declare id: number;
  declare orderId: number;
  declare productId: number;
  declare quantity: number;
  declare price: number;
  declare variantKey?: string | null;
  declare variantLabel?: string | null;
  declare variantSelections?: any;
  declare skuSnapshot?: string | null;
  declare barcodeSnapshot?: string | null;
  declare imageSnapshot?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    OrderItem.belongsTo(models.Order, { foreignKey: "orderId" });
    OrderItem.belongsTo(models.Product, {
      as: "product",
      foreignKey: "productId",
    });
  }

  static initModel(sequelize: Sequelize): typeof OrderItem {
    OrderItem.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        orderId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: 'order_id',
        },
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: 'product_id',
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        price: {
          type: DataTypes.DECIMAL(10, 2),
          allowNull: false,
        },
        variantKey: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        variantLabel: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        variantSelections: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        skuSnapshot: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        barcodeSnapshot: {
          type: DataTypes.STRING(100),
          allowNull: true,
        },
        imageSnapshot: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "OrderItem",
        tableName: "OrderItems",
        underscored: false,
      }
    );
    return OrderItem;
  }
}
