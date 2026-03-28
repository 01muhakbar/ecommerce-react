"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function indexExists(queryInterface, tableName, indexName) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    return indexes.some((index) => String(index.name || "") === indexName);
  } catch {
    return false;
  }
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  if (await indexExists(queryInterface, tableName, options.name)) return;
  await queryInterface.addIndex(tableName, fields, options);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "store_applications";
    if (!(await tableExists(queryInterface, tableName))) {
      await queryInterface.createTable(tableName, {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        applicant_user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        status: {
          type: Sequelize.ENUM(
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
        current_step: {
          type: Sequelize.ENUM(
            "owner_identity",
            "store_information",
            "operational_address",
            "payout_payment",
            "compliance",
            "review"
          ),
          allowNull: false,
          defaultValue: "owner_identity",
        },
        owner_identity_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        store_information_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        operational_address_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        payout_payment_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        compliance_snapshot: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        submitted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        reviewed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        reviewed_by_user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: "users",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "SET NULL",
        },
        revision_note: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        reject_reason: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        internal_metadata: {
          type: Sequelize.JSON,
          allowNull: true,
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
        },
      });
    }

    await addIndexIfMissing(queryInterface, tableName, ["applicant_user_id"], {
      name: "idx_store_applications_applicant_user_id",
    });
    await addIndexIfMissing(queryInterface, tableName, ["status"], {
      name: "idx_store_applications_status",
    });
    await addIndexIfMissing(queryInterface, tableName, ["applicant_user_id", "status"], {
      name: "idx_store_applications_applicant_status",
    });
  },

  async down(queryInterface) {
    const tableName = "store_applications";
    if (await tableExists(queryInterface, tableName)) {
      await queryInterface.dropTable(tableName);
    }
  },
};
