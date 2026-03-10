import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StorePaymentProfileAttributes {
  id: number;
  storeId: number;
  providerCode: "MANUAL_QRIS";
  paymentType: "QRIS_STATIC";
  accountName: string;
  merchantName: string;
  merchantId?: string | null;
  qrisImageUrl: string;
  qrisPayload?: string | null;
  instructionText?: string | null;
  isActive: boolean;
  verificationStatus: "PENDING" | "ACTIVE" | "REJECTED" | "INACTIVE";
  verifiedByAdminId?: number | null;
  verifiedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StorePaymentProfileCreationAttributes = Optional<
  StorePaymentProfileAttributes,
  | "id"
  | "providerCode"
  | "paymentType"
  | "merchantId"
  | "qrisPayload"
  | "instructionText"
  | "isActive"
  | "verificationStatus"
  | "verifiedByAdminId"
  | "verifiedAt"
>;

export class StorePaymentProfile
  extends Model<
    StorePaymentProfileAttributes,
    StorePaymentProfileCreationAttributes
  >
  implements StorePaymentProfileAttributes
{
  declare id: number;
  declare storeId: number;
  declare providerCode: "MANUAL_QRIS";
  declare paymentType: "QRIS_STATIC";
  declare accountName: string;
  declare merchantName: string;
  declare merchantId?: string | null;
  declare qrisImageUrl: string;
  declare qrisPayload?: string | null;
  declare instructionText?: string | null;
  declare isActive: boolean;
  declare verificationStatus: "PENDING" | "ACTIVE" | "REJECTED" | "INACTIVE";
  declare verifiedByAdminId?: number | null;
  declare verifiedAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    StorePaymentProfile.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
    StorePaymentProfile.belongsTo(models.User, {
      foreignKey: { name: "verifiedByAdminId", field: "verified_by_admin_id" },
      as: "verifiedByAdmin",
    });
    StorePaymentProfile.hasMany(models.Suborder, {
      foreignKey: { name: "storePaymentProfileId", field: "store_payment_profile_id" },
      as: "suborders",
    });
    StorePaymentProfile.hasMany(models.Payment, {
      foreignKey: { name: "storePaymentProfileId", field: "store_payment_profile_id" },
      as: "payments",
    });
  }

  static initModel(sequelize: Sequelize) {
    return StorePaymentProfile.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        storeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          field: "store_id",
          references: {
            model: "stores",
            key: "id",
          },
        },
        providerCode: {
          type: DataTypes.ENUM("MANUAL_QRIS"),
          allowNull: false,
          defaultValue: "MANUAL_QRIS",
          field: "provider_code",
        },
        paymentType: {
          type: DataTypes.ENUM("QRIS_STATIC"),
          allowNull: false,
          defaultValue: "QRIS_STATIC",
          field: "payment_type",
        },
        accountName: {
          type: DataTypes.STRING(160),
          allowNull: false,
          field: "account_name",
        },
        merchantName: {
          type: DataTypes.STRING(160),
          allowNull: false,
          field: "merchant_name",
        },
        merchantId: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: "merchant_id",
        },
        qrisImageUrl: {
          type: DataTypes.TEXT("long"),
          allowNull: false,
          field: "qris_image_url",
        },
        qrisPayload: {
          type: DataTypes.TEXT("long"),
          allowNull: true,
          field: "qris_payload",
        },
        instructionText: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "instruction_text",
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "is_active",
        },
        verificationStatus: {
          type: DataTypes.ENUM("PENDING", "ACTIVE", "REJECTED", "INACTIVE"),
          allowNull: false,
          defaultValue: "PENDING",
          field: "verification_status",
        },
        verifiedByAdminId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "verified_by_admin_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        verifiedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "verified_at",
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: "created_at",
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          field: "updated_at",
        },
      },
      {
        sequelize,
        modelName: "StorePaymentProfile",
        tableName: "store_payment_profiles",
        underscored: true,
      }
    );
  }
}
