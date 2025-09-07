import { DataTypes, Model } from "sequelize";
export class CartItem extends Model {
    static associate(models) {
        // No explicit associations defined here, as it's a through model
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
        }, {
            sequelize,
            modelName: "CartItem",
        });
        return CartItem;
    }
}
