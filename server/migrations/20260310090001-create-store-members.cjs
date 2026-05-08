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
    const exists = await tableExists(queryInterface, "store_members");
    if (exists) return;

    await queryInterface.createTable("store_members", {
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
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      store_role_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: "store_roles",
          key: "id",
        },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      status: {
        type: Sequelize.ENUM("ACTIVE", "INACTIVE"),
        allowNull: false,
        defaultValue: "ACTIVE",
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

    await queryInterface.addConstraint("store_members", {
      type: "unique",
      name: "uq_store_members_store_user",
      fields: ["store_id", "user_id"],
    });

    await queryInterface.addIndex("store_members", ["user_id"], {
      name: "idx_store_members_user_id",
    });

    await queryInterface.addIndex("store_members", ["store_role_id"], {
      name: "idx_store_members_store_role_id",
    });

    await queryInterface.addIndex("store_members", ["status"], {
      name: "idx_store_members_status",
    });
  },

  async down(queryInterface) {
    if (await tableExists(queryInterface, "store_members")) {
      await queryInterface.dropTable("store_members");
    }
  },
};
