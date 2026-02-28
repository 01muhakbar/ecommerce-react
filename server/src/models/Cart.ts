import { DataTypes, Model, Sequelize, Optional } from "sequelize";
import { User } from "./User.js"; // Pastikan User diimpor

interface CartAttributes {
  id: number;
  userId: number;
}

interface CartCreationAttributes extends Optional<CartAttributes, "id"> {}

export class Cart
  extends Model<CartAttributes, CartCreationAttributes>
  implements CartAttributes
{
  declare id: number;
  declare userId: number;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    // Definisikan relasi di sini
    Cart.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
    });
    Cart.belongsToMany(models.Product, {
      through: models.CartItem, // Gunakan model langsung
      as: "Products",
      foreignKey: "cartId", // GUNAKAN camelCase agar konsisten
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
        // --- PERBAIKAN DI SINI ---
        // Pastikan tipe data sama dengan primary key di tabel User
        userId: {
          type: DataTypes.INTEGER.UNSIGNED, // <-- PASTIKAN ADA .UNSIGNED
          allowNull: false,
          references: {
            // Referensi ini sudah benar
            model: "Users", // Nama tabel yang direferensikan
            key: "id",
          },
        },
      },
      {
        sequelize,
        modelName: "Cart",
        tableName: "Carts",
        underscored: true,
      }
    );
    return Cart;
  }
}
