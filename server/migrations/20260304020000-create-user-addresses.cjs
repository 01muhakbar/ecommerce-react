"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("user_addresses", {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
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
      full_name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      phone_number: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      province: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      city: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      district: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      postal_code: {
        type: Sequelize.STRING(10),
        allowNull: false,
      },
      street_name: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      building: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      house_number: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      other_details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      mark_as: {
        type: Sequelize.ENUM("HOME", "OFFICE"),
        allowNull: false,
        defaultValue: "HOME",
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_store: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      is_return: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addIndex("user_addresses", ["user_id"], {
      name: "idx_user_addresses_user_id",
    });
    await queryInterface.addIndex("user_addresses", ["user_id", "is_primary"], {
      name: "idx_user_addresses_user_primary",
    });
    await queryInterface.addIndex("user_addresses", ["user_id", "is_store"], {
      name: "idx_user_addresses_user_store",
    });
    await queryInterface.addIndex("user_addresses", ["user_id", "is_return"], {
      name: "idx_user_addresses_user_return",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex("user_addresses", "idx_user_addresses_user_return").catch(() => {});
    await queryInterface.removeIndex("user_addresses", "idx_user_addresses_user_store").catch(() => {});
    await queryInterface.removeIndex("user_addresses", "idx_user_addresses_user_primary").catch(() => {});
    await queryInterface.removeIndex("user_addresses", "idx_user_addresses_user_id").catch(() => {});
    await queryInterface.dropTable("user_addresses");
  },
};
