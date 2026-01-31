import { DataTypes, Model } from "sequelize";
export class Coupon extends Model {
    static initModel(sequelize) {
        Coupon.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            code: {
                type: DataTypes.STRING,
                unique: true,
                allowNull: false,
            },
            discountType: {
                type: DataTypes.ENUM("percent", "fixed"),
                defaultValue: "percent",
            },
            amount: {
                type: DataTypes.DECIMAL(10, 2),
                allowNull: false,
            },
            minSpend: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
            },
            active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
            expiresAt: DataTypes.DATE,
        }, {
            sequelize,
            modelName: "Coupon",
            tableName: "coupons",
            underscored: true,
        });
        return Coupon;
    }
}
