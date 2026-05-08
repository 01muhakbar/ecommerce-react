"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const definition = await queryInterface.describeTable(tableName);
    return Boolean(definition?.[columnName]);
  } catch {
    return false;
  }
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  if (await columnExists(queryInterface, tableName, columnName)) return;
  await queryInterface.addColumn(tableName, columnName, definition);
}

async function addIndexIfMissing(queryInterface, tableName, fields, name) {
  const indexes = await queryInterface.showIndex(tableName);
  if (indexes.some((index) => String(index.name) === name)) return;
  await queryInterface.addIndex(tableName, fields, { name });
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "store_members"))) return;

    await addColumnIfMissing(queryInterface, "store_members", "invited_by_user_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await addColumnIfMissing(queryInterface, "store_members", "invited_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, "store_members", "accepted_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, "store_members", "disabled_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, "store_members", "disabled_by_user_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await addColumnIfMissing(queryInterface, "store_members", "removed_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, "store_members", "removed_by_user_id", {
      type: Sequelize.INTEGER.UNSIGNED,
      allowNull: true,
      references: {
        model: "users",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE store_members
      MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'INVITED', 'DISABLED', 'REMOVED')
      NOT NULL DEFAULT 'ACTIVE'
    `);

    await queryInterface.sequelize.query(`
      UPDATE store_members
      SET status = 'DISABLED'
      WHERE status = 'INACTIVE'
    `);

    await queryInterface.sequelize.query(`
      UPDATE store_members
      SET accepted_at = COALESCE(accepted_at, created_at),
          disabled_at = NULL,
          disabled_by_user_id = NULL,
          removed_at = NULL,
          removed_by_user_id = NULL
      WHERE status = 'ACTIVE'
    `);

    await queryInterface.sequelize.query(`
      UPDATE store_members
      SET disabled_at = COALESCE(disabled_at, updated_at, created_at),
          removed_at = NULL,
          removed_by_user_id = NULL
      WHERE status = 'DISABLED'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE store_members
      MODIFY COLUMN status ENUM('INVITED', 'ACTIVE', 'DISABLED', 'REMOVED')
      NOT NULL DEFAULT 'ACTIVE'
    `);

    await addIndexIfMissing(
      queryInterface,
      "store_members",
      ["invited_by_user_id"],
      "idx_store_members_invited_by_user_id"
    );
    await addIndexIfMissing(
      queryInterface,
      "store_members",
      ["disabled_by_user_id"],
      "idx_store_members_disabled_by_user_id"
    );
    await addIndexIfMissing(
      queryInterface,
      "store_members",
      ["removed_by_user_id"],
      "idx_store_members_removed_by_user_id"
    );
  },

  async down(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "store_members"))) return;

    await queryInterface.sequelize.query(`
      ALTER TABLE store_members
      MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'INVITED', 'DISABLED', 'REMOVED')
      NOT NULL DEFAULT 'ACTIVE'
    `);

    await queryInterface.sequelize.query(`
      UPDATE store_members
      SET status = 'INACTIVE'
      WHERE status IN ('INVITED', 'DISABLED', 'REMOVED')
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE store_members
      MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE')
      NOT NULL DEFAULT 'ACTIVE'
    `);

    const indexedColumns = [
      ["idx_store_members_invited_by_user_id", "invited_by_user_id"],
      ["idx_store_members_disabled_by_user_id", "disabled_by_user_id"],
      ["idx_store_members_removed_by_user_id", "removed_by_user_id"],
    ];

    for (const [indexName, columnName] of indexedColumns) {
      const indexes = await queryInterface.showIndex("store_members");
      if (indexes.some((index) => String(index.name) === indexName)) {
        await queryInterface.removeIndex("store_members", indexName);
      }
      if (await columnExists(queryInterface, "store_members", columnName)) {
        await queryInterface.removeColumn("store_members", columnName);
      }
    }

    const nullableColumns = [
      "invited_at",
      "accepted_at",
      "disabled_at",
      "removed_at",
    ];

    for (const columnName of nullableColumns) {
      if (await columnExists(queryInterface, "store_members", columnName)) {
        await queryInterface.removeColumn("store_members", columnName);
      }
    }
  },
};
