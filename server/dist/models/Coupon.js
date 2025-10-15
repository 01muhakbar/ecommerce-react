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
            type: {
                type: DataTypes.ENUM("percent", "fixed"),
                defaultValue: "percent",
            },
            value: {
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: false,
            },
            active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
            startsAt: DataTypes.DATE,
            endsAt: DataTypes.DATE,
        }, {
            sequelize,
            modelName: "Coupon",
            tableName: "coupons",
            underscored: true,
        });
        return Coupon;
    }
}
