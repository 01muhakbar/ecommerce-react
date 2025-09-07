import { Model, DataTypes, } from "sequelize";
export class Order extends Model {
    static associate(models) {
        Order.belongsTo(models.User, { foreignKey: "userId", as: "user" });
        Order.belongsToMany(models.Product, {
            through: "OrderItem",
            as: "products",
        });
    }
}
export const initOrder = (sequelize) => {
    Order.init({
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        invoiceNo: { type: DataTypes.STRING, allowNull: false, unique: true },
        userId: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: "Users", key: "id" },
        },
        totalAmount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        status: {
            type: DataTypes.ENUM("pending", "processing", "shipped", "completed", "cancelled"),
            defaultValue: "pending",
            allowNull: false,
        },
    }, {
        sequelize,
        modelName: "Order",
    });
};
