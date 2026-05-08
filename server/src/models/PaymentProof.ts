import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface PaymentProofAttributes {
  id: number;
  paymentId: number;
  uploadedByUserId: number;
  proofImageUrl: string;
  senderName: string;
  senderBankOrWallet: string;
  transferAmount: number;
  transferTime: Date;
  note?: string | null;
  reviewNote?: string | null;
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  reviewedByUserId?: number | null;
  reviewedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type PaymentProofCreationAttributes = Optional<
  PaymentProofAttributes,
  "id" | "note" | "reviewNote" | "reviewStatus" | "reviewedByUserId" | "reviewedAt"
>;

export class PaymentProof
  extends Model<PaymentProofAttributes, PaymentProofCreationAttributes>
  implements PaymentProofAttributes
{
  declare id: number;
  declare paymentId: number;
  declare uploadedByUserId: number;
  declare proofImageUrl: string;
  declare senderName: string;
  declare senderBankOrWallet: string;
  declare transferAmount: number;
  declare transferTime: Date;
  declare note?: string | null;
  declare reviewNote?: string | null;
  declare reviewStatus: "PENDING" | "APPROVED" | "REJECTED";
  declare reviewedByUserId?: number | null;
  declare reviewedAt?: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    PaymentProof.belongsTo(models.Payment, {
      foreignKey: { name: "paymentId", field: "payment_id" },
      as: "payment",
    });
    PaymentProof.belongsTo(models.User, {
      foreignKey: { name: "uploadedByUserId", field: "uploaded_by_user_id" },
      as: "uploadedByUser",
    });
    PaymentProof.belongsTo(models.User, {
      foreignKey: { name: "reviewedByUserId", field: "reviewed_by_user_id" },
      as: "reviewedByUser",
    });
  }

  static initModel(sequelize: Sequelize) {
    return PaymentProof.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        paymentId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "payment_id",
          references: {
            model: "payments",
            key: "id",
          },
        },
        uploadedByUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "uploaded_by_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        proofImageUrl: {
          type: DataTypes.TEXT("long"),
          allowNull: false,
          field: "proof_image_url",
        },
        senderName: {
          type: DataTypes.STRING(160),
          allowNull: false,
          field: "sender_name",
        },
        senderBankOrWallet: {
          type: DataTypes.STRING(160),
          allowNull: false,
          field: "sender_bank_or_wallet",
        },
        transferAmount: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          field: "transfer_amount",
        },
        transferTime: {
          type: DataTypes.DATE,
          allowNull: false,
          field: "transfer_time",
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        reviewNote: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "review_note",
        },
        reviewStatus: {
          type: DataTypes.ENUM("PENDING", "APPROVED", "REJECTED"),
          allowNull: false,
          defaultValue: "PENDING",
          field: "review_status",
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
        reviewedAt: {
          type: DataTypes.DATE,
          allowNull: true,
          field: "reviewed_at",
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
        modelName: "PaymentProof",
        tableName: "payment_proofs",
        underscored: true,
      }
    );
  }
}
