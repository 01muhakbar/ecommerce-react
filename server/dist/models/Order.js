import { Model, DataTypes, } from "sequelize";
export class Order extends Model {
    static associate(models) {
        Order.belongsTo(models.User, {
            foreignKey: { name: "userId", field: "user_id" },
            as: "customer", // Using 'customer' as alias for User in Order context
        });
        Order.hasMany(models.OrderItem, {
            foreignKey: { name: "orderId", field: "order_id" },
            as: "items",
        });
    }
    static initModel(sequelize) {
        Order.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            invoiceNo: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true,
            },
            userId: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
                references: { model: "Users", key: "id" },
            },
            customerName: {
                type: DataTypes.STRING(120),
                allowNull: true,
                field: "customer_name",
            },
            customerPhone: {
                type: DataTypes.STRING(30),
                allowNull: true,
                field: "customer_phone",
            },
            customerAddress: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: "customer_address",
            },
            customerNotes: {
                type: DataTypes.TEXT,
                allowNull: true,
                field: "customer_notes",
            },
            paymentMethod: {
                type: DataTypes.STRING(30),
                allowNull: true,
                field: "payment_method",
            },
            couponCode: {
                type: DataTypes.STRING(50),
                allowNull: true,
                field: "coupon_code",
            },
            discountAmount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: true,
                field: "discount_amount",
            },
            totalAmount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM("pending", "paid", "processing", "shipped", "delivered", "completed", "cancelled"),
                defaultValue: "pending",
                allowNull: false,
            },
        }, {
            sequelize,
            modelName: "Order",
            tableName: "Orders",
            underscored: true,
        });
        return Order;
    }
}
