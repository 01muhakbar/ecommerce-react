'use strict';

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

async function indexExists(queryInterface, tableName, indexName) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    return indexes.some((index) => String(index.name || '') === indexName);
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
    const tableName = 'suborders';
    if (!(await tableExists(queryInterface, tableName))) return;

    if (!(await columnExists(queryInterface, tableName, 'applied_coupon_id'))) {
      await queryInterface.addColumn(tableName, 'applied_coupon_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'coupons',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'applied_coupon_code'))) {
      await queryInterface.addColumn(tableName, 'applied_coupon_code', {
        type: Sequelize.STRING(120),
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, tableName, 'applied_coupon_scope_type'))) {
      await queryInterface.addColumn(tableName, 'applied_coupon_scope_type', {
        type: Sequelize.ENUM('PLATFORM', 'STORE'),
        allowNull: true,
      });
    }

    await addIndexIfMissing(queryInterface, tableName, ['applied_coupon_id'], {
      name: 'idx_suborders_applied_coupon_id',
    });
    await addIndexIfMissing(queryInterface, tableName, ['store_id', 'applied_coupon_scope_type'], {
      name: 'idx_suborders_store_coupon_scope',
    });
  },

  async down(queryInterface) {
    const tableName = 'suborders';

    if (await indexExists(queryInterface, tableName, 'idx_suborders_store_coupon_scope')) {
      await queryInterface.removeIndex(tableName, 'idx_suborders_store_coupon_scope');
    }
    if (await indexExists(queryInterface, tableName, 'idx_suborders_applied_coupon_id')) {
      await queryInterface.removeIndex(tableName, 'idx_suborders_applied_coupon_id');
    }

    if (await columnExists(queryInterface, tableName, 'applied_coupon_scope_type')) {
      await queryInterface.removeColumn(tableName, 'applied_coupon_scope_type');
    }
    if (await columnExists(queryInterface, tableName, 'applied_coupon_code')) {
      await queryInterface.removeColumn(tableName, 'applied_coupon_code');
    }
    if (await columnExists(queryInterface, tableName, 'applied_coupon_id')) {
      await queryInterface.removeColumn(tableName, 'applied_coupon_id');
    }

    try {
      await queryInterface.sequelize.query("DROP TYPE IF EXISTS applied_coupon_scope_type;");
    } catch {
      // noop
    }
  },
};
