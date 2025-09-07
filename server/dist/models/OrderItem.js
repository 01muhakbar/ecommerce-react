import { DataTypes, Model } from "sequelize";
export class OrderItem extends Model {
    static associate(models) {
        OrderItem.belongsTo(models.Order, { foreignKey: "orderId" });
        OrderItem.belongsTo(models.Product, { foreignKey: "productId" });
    }
    static initModel(sequelize) {
        OrderItem.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            orderId: {
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
            },
            price: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
        }, {
            sequelize,
            modelName: "OrderItem",
        });
        return OrderItem;
    }
}
