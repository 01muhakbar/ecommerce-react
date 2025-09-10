import { DataTypes, Model } from "sequelize";
export class Cart extends Model {
    static associate(models) {
        Cart.belongsTo(models.User, { foreignKey: "userId" });
        Cart.belongsToMany(models.Product, {
            through: models.CartItem,
            foreignKey: "cartId",
            otherKey: "productId",
        });
    }
    static initModel(sequelize) {
        Cart.init({
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
        }, {
            sequelize,
            modelName: "Cart",
        });
        return Cart;
    }
}
