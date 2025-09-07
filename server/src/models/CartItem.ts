import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CartItemAttributes {
  id: number;
  cartId: number;
  productId: number;
  quantity: number;
}

interface CartItemCreationAttributes
  extends Optional<CartItemAttributes, "id"> {}

export class CartItem
  extends Model<CartItemAttributes, CartItemCreationAttributes>
  implements CartItemAttributes
{
  public id!: number;
  public cartId!: number;
  public productId!: number;
  public quantity!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    // No explicit associations defined here, as it's a through model
  }

  static initModel(sequelize: Sequelize): typeof CartItem {
    CartItem.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        cartId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
        },
      },
      {
        sequelize,
        modelName: "CartItem",
      }
    );
    return CartItem;
  }
}
