import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StoreApplicationAttributes {
  id: number;
  applicantUserId: number;
  status:
    | "draft"
    | "submitted"
    | "under_review"
    | "revision_requested"
    | "approved"
    | "rejected"
    | "cancelled";
  currentStep:
    | "owner_identity"
    | "store_information"
    | "operational_address"
    | "payout_payment"
    | "compliance"
    | "review";
  ownerIdentitySnapshot?: Record<string, any> | null;
  storeInformationSnapshot?: Record<string, any> | null;
  operationalAddressSnapshot?: Record<string, any> | null;
  payoutPaymentSnapshot?: Record<string, any> | null;
  complianceSnapshot?: Record<string, any> | null;
  submittedAt?: Date | null;
  reviewedAt?: Date | null;
  reviewedByUserId?: number | null;
  revisionNote?: string | null;
  rejectReason?: string | null;
  internalMetadata?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StoreApplicationCreationAttributes = Optional<
  StoreApplicationAttributes,
  | "id"
  | "status"
  | "currentStep"
  | "ownerIdentitySnapshot"
  | "storeInformationSnapshot"
  | "operationalAddressSnapshot"
  | "payoutPaymentSnapshot"
  | "complianceSnapshot"
  | "submittedAt"
  | "reviewedAt"
  | "reviewedByUserId"
  | "revisionNote"
  | "rejectReason"
  | "internalMetadata"
>;

export class StoreApplication
  extends Model<StoreApplicationAttributes, StoreApplicationCreationAttributes>
  implements StoreApplicationAttributes
{
  declare id: number;
  declare applicantUserId: number;
  declare status:
    | "draft"
    | "submitted"
    | "under_review"
    | "revision_requested"
    | "approved"
    | "rejected"
    | "cancelled";
  declare currentStep:
    | "owner_identity"
    | "store_information"
    | "operational_address"
    | "payout_payment"
    | "compliance"
    | "review";
  declare ownerIdentitySnapshot?: Record<string, any> | null;
  declare storeInformationSnapshot?: Record<string, any> | null;
  declare operationalAddressSnapshot?: Record<string, any> | null;
  declare payoutPaymentSnapshot?: Record<string, any> | null;
  declare complianceSnapshot?: Record<string, any> | null;
  declare submittedAt?: Date | null;
  declare reviewedAt?: Date | null;
  declare reviewedByUserId?: number | null;
  declare revisionNote?: string | null;
  declare rejectReason?: string | null;
  declare internalMetadata?: Record<string, any> | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    models.User.hasMany(StoreApplication, {
      foreignKey: { name: "applicantUserId", field: "applicant_user_id" },
      as: "storeApplications",
    });
    models.User.hasMany(StoreApplication, {
      foreignKey: { name: "reviewedByUserId", field: "reviewed_by_user_id" },
      as: "reviewedStoreApplications",
    });

    StoreApplication.belongsTo(models.User, {
      foreignKey: { name: "applicantUserId", field: "applicant_user_id" },
      as: "applicantUser",
    });
    StoreApplication.belongsTo(models.User, {
      foreignKey: { name: "reviewedByUserId", field: "reviewed_by_user_id" },
      as: "reviewedByUser",
    });
  }

  static initModel(sequelize: Sequelize) {
    return StoreApplication.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        applicantUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "applicant_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        status: {
          type: DataTypes.ENUM(
            "draft",
            "submitted",
            "under_review",
            "revision_requested",
            "approved",
            "rejected",
            "cancelled"
          ),
          allowNull: false,
          defaultValue: "draft",
        },
        currentStep: {
          type: DataTypes.ENUM(
            "owner_identity",
            "store_information",
            "operational_address",
            "payout_payment",
            "compliance",
            "review"
          ),
          allowNull: false,
          defaultValue: "owner_identity",
          field: "current_step",
        },
        ownerIdentitySnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "owner_identity_snapshot",
        },
        storeInformationSnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "store_information_snapshot",
        },
        operationalAddressSnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "operational_address_snapshot",
        },
        payoutPaymentSnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "payout_payment_snapshot",
        },
        complianceSnapshot: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "compliance_snapshot",
        },
        submittedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "submitted_at",
        },
        reviewedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "reviewed_at",
        },
        reviewedByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: true,
          field: "reviewed_by_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        revisionNote: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "revision_note",
        },
        rejectReason: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "reject_reason",
        },
        internalMetadata: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "internal_metadata",
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
        modelName: "StoreApplication",
        tableName: "store_applications",
        underscored: true,
      }
    );
  }
}
