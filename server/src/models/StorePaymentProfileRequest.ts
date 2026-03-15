import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StorePaymentProfileRequestAttributes {
  id: number;
  storeId: number;
  basedOnProfileId?: number | null;
  requestStatus: "DRAFT" | "SUBMITTED" | "NEEDS_REVISION" | "REJECTED" | "APPROVED" | "PROMOTED";
  accountName?: string | null;
  merchantName?: string | null;
  merchantId?: string | null;
  qrisImageUrl?: string | null;
  qrisPayload?: string | null;
  instructionText?: string | null;
  sellerNote?: string | null;
  adminReviewNote?: string | null;
  submittedByUserId?: number | null;
  submittedAt?: Date | null;
  reviewedByAdminId?: number | null;
  reviewedAt?: Date | null;
  promotedProfileId?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StorePaymentProfileRequestCreationAttributes = Optional<
  StorePaymentProfileRequestAttributes,
  | "id"
  | "basedOnProfileId"
  | "requestStatus"
  | "merchantId"
  | "qrisPayload"
  | "instructionText"
  | "sellerNote"
  | "adminReviewNote"
  | "submittedByUserId"
  | "submittedAt"
  | "reviewedByAdminId"
  | "reviewedAt"
  | "promotedProfileId"
>;

export class StorePaymentProfileRequest
  extends Model<
    StorePaymentProfileRequestAttributes,
    StorePaymentProfileRequestCreationAttributes
  >
  implements StorePaymentProfileRequestAttributes
{
  declare id: number;
  declare storeId: number;
  declare basedOnProfileId?: number | null;
  declare requestStatus:
    | "DRAFT"
    | "SUBMITTED"
    | "NEEDS_REVISION"
    | "REJECTED"
    | "APPROVED"
    | "PROMOTED";
  declare accountName?: string | null;
  declare merchantName?: string | null;
  declare merchantId?: string | null;
  declare qrisImageUrl?: string | null;
  declare qrisPayload?: string | null;
  declare instructionText?: string | null;
  declare sellerNote?: string | null;
  declare adminReviewNote?: string | null;
  declare submittedByUserId?: number | null;
  declare submittedAt?: Date | null;
  declare reviewedByAdminId?: number | null;
  declare reviewedAt?: Date | null;
  declare promotedProfileId?: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    StorePaymentProfileRequest.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
    StorePaymentProfileRequest.belongsTo(models.StorePaymentProfile, {
      foreignKey: { name: "basedOnProfileId", field: "based_on_profile_id" },
      as: "basedOnProfile",
    });
    StorePaymentProfileRequest.belongsTo(models.StorePaymentProfile, {
      foreignKey: { name: "promotedProfileId", field: "promoted_profile_id" },
      as: "promotedProfile",
    });
    StorePaymentProfileRequest.belongsTo(models.User, {
      foreignKey: { name: "submittedByUserId", field: "submitted_by_user_id" },
      as: "submittedByUser",
    });
    StorePaymentProfileRequest.belongsTo(models.User, {
      foreignKey: { name: "reviewedByAdminId", field: "reviewed_by_admin_id" },
      as: "reviewedByAdmin",
    });
  }

  static initModel(sequelize: Sequelize) {
    return StorePaymentProfileRequest.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        storeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "store_id",
          references: {
            model: "stores",
            key: "id",
          },
        },
        basedOnProfileId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "based_on_profile_id",
          references: {
            model: "store_payment_profiles",
            key: "id",
          },
        },
        requestStatus: {
          type: DataTypes.ENUM(
            "DRAFT",
            "SUBMITTED",
            "NEEDS_REVISION",
            "REJECTED",
            "APPROVED",
            "PROMOTED"
          ),
          allowNull: false,
          defaultValue: "DRAFT",
          field: "request_status",
        },
        accountName: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: "account_name",
        },
        merchantName: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: "merchant_name",
        },
        merchantId: {
          type: DataTypes.STRING(160),
          allowNull: true,
          field: "merchant_id",
        },
        qrisImageUrl: {
          type: DataTypes.TEXT("long"),
          allowNull: true,
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
        sellerNote: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "seller_note",
        },
        adminReviewNote: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "admin_review_note",
        },
        submittedByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "submitted_by_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        submittedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "submitted_at",
        },
        reviewedByAdminId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "reviewed_by_admin_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        reviewedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "reviewed_at",
        },
        promotedProfileId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "promoted_profile_id",
          references: {
            model: "store_payment_profiles",
            key: "id",
          },
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
        modelName: "StorePaymentProfileRequest",
        tableName: "store_payment_profile_requests",
        underscored: true,
      }
    );
  }
}
