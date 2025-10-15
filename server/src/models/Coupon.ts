import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CouponAttributes {
  id: number;
  code: string;
  type: "percent" | "fixed";
  value: number;
  active: boolean;
  startsAt?: Date;
  endsAt?: Date;
}

interface CouponCreationAttributes extends Optional<CouponAttributes, "id" | "active" | "type"> {}

export class Coupon extends Model<CouponAttributes, CouponCreationAttributes> implements CouponAttributes {
  public id!: number;
  public code!: string;
  public type!: "percent" | "fixed";
  public value!: number;
  public active!: boolean;
  public startsAt?: Date;
  public endsAt?: Date;

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