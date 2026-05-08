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

    if (!(await columnExists(queryInterface, tableName, 'seller_submission_status'))) {
      await queryInterface.addColumn(tableName, 'seller_submission_status', {
        type: Sequelize.ENUM('none', 'submitted'),
        allowNull: false,
        defaultValue: 'none',
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'seller_submitted_at'))) {
      await queryInterface.addColumn(tableName, 'seller_submitted_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'seller_submitted_by_user_id'))) {
      await queryInterface.addColumn(tableName, 'seller_submitted_by_user_id', {
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

    await queryInterface.sequelize.query(`
      UPDATE ${tableName}
      SET seller_submission_status = COALESCE(seller_submission_status, 'none')
      WHERE seller_submission_status IS NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    const tableName = await resolveProductsTableName(queryInterface);
    if (!tableName) return;

    if (await columnExists(queryInterface, tableName, 'seller_submitted_by_user_id')) {
      await queryInterface.removeColumn(tableName, 'seller_submitted_by_user_id');
    }

    if (await columnExists(queryInterface, tableName, 'seller_submitted_at')) {
      await queryInterface.removeColumn(tableName, 'seller_submitted_at');
    }

    if (await columnExists(queryInterface, tableName, 'seller_submission_status')) {
      await queryInterface.removeColumn(tableName, 'seller_submission_status');
    }

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE ${tableName}
        DROP CHECK seller_submission_status
      `);
    } catch {
      // noop for dialects without named checks
    }
  },
};
