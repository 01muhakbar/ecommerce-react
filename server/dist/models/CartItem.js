import { DataTypes, Model } from "sequelize";
export class CartItem extends Model {
    static associate(models) {
        // Definisikan relasi balik ke Cart dan Product
        CartItem.belongsTo(models.Cart, { foreignKey: "cartId" });
        CartItem.belongsTo(models.Product, { foreignKey: "productId" });
    }
    static initModel(sequelize) {
        CartItem.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            cartId: {
                type: DataTypes.INTEGER.UNSIGNED,
                field: "cart_id",
                allowNull: false,
            },
            productId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                field: "product_id",
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
        }, {
            sequelize,
            modelName: "CartItem",
            underscored: true,
        });
        return CartItem;
    }
}
