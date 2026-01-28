import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CouponAttributes {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  amount: number;
  minSpend: number;
  active: boolean;
  expiresAt?: Date | null;
}

interface CouponCreationAttributes
  extends Optional<CouponAttributes, "id" | "active" | "discountType" | "minSpend" | "expiresAt"> {}

export class Coupon extends Model<CouponAttributes, CouponCreationAttributes> implements CouponAttributes {
  public id!: number;
  public code!: string;
  public discountType!: "percent" | "fixed";
  public amount!: number;
  public minSpend!: number;
  public active!: boolean;
  public expiresAt?: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static initModel(sequelize: Sequelize): typeof Coupon {
    Coupon.init(
      {
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
      },
      {
        sequelize,
        modelName: "Coupon",
        tableName: "coupons",
        underscored: true,
      }
    );
    return Coupon;
  }
}
