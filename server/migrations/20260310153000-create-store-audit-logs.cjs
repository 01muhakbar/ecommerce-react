"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await tableExists(queryInterface, "store_audit_logs");
    if (exists) return;

    await queryInterface.createTable("store_audit_logs", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      store_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "stores",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      actor_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      target_user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      target_member_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: "store_members",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      action: {
        type: Sequelize.STRING(80),
        allowNull: false,
      },
      before_state: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      after_state: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex("store_audit_logs", ["store_id"], {
      name: "idx_store_audit_logs_store_id",
    });
    await queryInterface.addIndex("store_audit_logs", ["actor_user_id"], {
      name: "idx_store_audit_logs_actor_user_id",
    });
    await queryInterface.addIndex("store_audit_logs", ["target_member_id"], {
      name: "idx_store_audit_logs_target_member_id",
    });
    await queryInterface.addIndex("store_audit_logs", ["action"], {
      name: "idx_store_audit_logs_action",
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "store_audit_logs")) {
      await queryInterface.dropTable("store_audit_logs");
    }
  },
};
