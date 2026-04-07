import { DataTypes, Model, Sequelize, Optional } from "sequelize";

export type CouponScopeType = "PLATFORM" | "STORE";

interface CouponAttributes {
  id: number;
  code: string;
  discountType: "percent" | "fixed";
  amount: number;
  minSpend: number;
  active: boolean;
  bannerImageUrl?: string | null;
  scopeType: CouponScopeType;
  storeId?: number | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
}

interface CouponCreationAttributes
  extends Optional<
    CouponAttributes,
    "id" | "active" | "discountType" | "minSpend" | "scopeType" | "storeId" | "startsAt" | "expiresAt"
  > {}

export class Coupon extends Model<CouponAttributes, CouponCreationAttributes> implements CouponAttributes {
  declare id: number;
  declare code: string;
  declare discountType: "percent" | "fixed";
  declare amount: number;
  declare minSpend: number;
  declare active: boolean;
  declare bannerImageUrl: string | null;
  declare scopeType: CouponScopeType;
  declare storeId: number | null;
  declare startsAt: Date | null;
  declare expiresAt?: Date | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    Coupon.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
  }

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
        bannerImageUrl: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "banner_image_url",
        },
        scopeType: {
          type: DataTypes.ENUM("PLATFORM", "STORE"),
          allowNull: false,
          defaultValue: "PLATFORM",
          field: "scope_type",
        },
        storeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "store_id",
          references: {
            model: "stores",
            key: "id",
          },
        },
        startsAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "starts_at",
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
