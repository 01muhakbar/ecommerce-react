import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CartAttributes {
  id: number;
  userId: number;
}

interface CartCreationAttributes extends Optional<CartAttributes, "id"> {}

export class Cart
  extends Model<CartAttributes, CartCreationAttributes>
  implements CartAttributes
{
  public id!: number;
  public userId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    Cart.belongsTo(models.User, { foreignKey: "userId" });

    Cart.belongsToMany(models.Product, {
      through: models.CartItem,
      foreignKey: "cartId",
      otherKey: "productId",
    });
  }

  static initModel(sequelize: Sequelize): typeof Cart {
    Cart.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: "Users", // Nama tabel yang direferensikan
            key: "id",
          },
        },
      },
      {
        sequelize,
        modelName: "Cart",
      }
    );
    return Cart;
  }
}
