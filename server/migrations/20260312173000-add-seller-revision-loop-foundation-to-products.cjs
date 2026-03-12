'use strict';

async function resolveProductsTableName(queryInterface) {
  for (const tableName of ['products', 'Products']) {
    try {
      await queryInterface.describeTable(tableName);
      return tableName;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const definition = await queryInterface.describeTable(tableName);
    return Boolean(definition?.[columnName]);
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = await resolveProductsTableName(queryInterface);
    if (!tableName) return;

    await queryInterface.sequelize.query(`
      ALTER TABLE ${tableName}
      MODIFY COLUMN seller_submission_status ENUM('none', 'submitted', 'needs_revision')
      NOT NULL DEFAULT 'none'
    `);

    if (!(await columnExists(queryInterface, tableName, 'seller_revision_requested_at'))) {
      await queryInterface.addColumn(tableName, 'seller_revision_requested_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'seller_revision_requested_by_user_id'))) {
      await queryInterface.addColumn(tableName, 'seller_revision_requested_by_user_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'seller_revision_note'))) {
      await queryInterface.addColumn(tableName, 'seller_revision_note', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = await resolveProductsTableName(queryInterface);
    if (!tableName) return;

    if (await columnExists(queryInterface, tableName, 'seller_revision_note')) {
      await queryInterface.removeColumn(tableName, 'seller_revision_note');
    }

    if (await columnExists(queryInterface, tableName, 'seller_revision_requested_by_user_id')) {
      await queryInterface.removeColumn(tableName, 'seller_revision_requested_by_user_id');
    }

    if (await columnExists(queryInterface, tableName, 'seller_revision_requested_at')) {
      await queryInterface.removeColumn(tableName, 'seller_revision_requested_at');
    }

    await queryInterface.sequelize.query(`
      UPDATE ${tableName}
      SET seller_submission_status = 'submitted'
      WHERE seller_submission_status = 'needs_revision'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE ${tableName}
      MODIFY COLUMN seller_submission_status ENUM('none', 'submitted')
      NOT NULL DEFAULT 'none'
    `);
  },
};
