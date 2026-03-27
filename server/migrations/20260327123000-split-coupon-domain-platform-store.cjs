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
    const couponsTable = 'coupons';
    const storesTable = 'stores';

    if (!(await tableExists(queryInterface, couponsTable))) return;

    if (!(await columnExists(queryInterface, couponsTable, 'scope_type'))) {
      await queryInterface.addColumn(couponsTable, 'scope_type', {
        type: Sequelize.ENUM('PLATFORM', 'STORE'),
        allowNull: false,
        defaultValue: 'PLATFORM',
      });
    }

    if (!(await columnExists(queryInterface, couponsTable, 'store_id'))) {
      await queryInterface.addColumn(couponsTable, 'store_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: storesTable,
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, couponsTable, 'starts_at'))) {
      await queryInterface.addColumn(couponsTable, 'starts_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await addIndexIfMissing(queryInterface, couponsTable, ['scope_type'], {
      name: 'idx_coupons_scope_type',
    });
    await addIndexIfMissing(queryInterface, couponsTable, ['store_id'], {
      name: 'idx_coupons_store_id',
    });
    await addIndexIfMissing(queryInterface, couponsTable, ['scope_type', 'active'], {
      name: 'idx_coupons_scope_active',
    });

    await queryInterface.sequelize.query(`
      UPDATE ${couponsTable}
      SET
        scope_type = CASE
          WHEN store_id IS NULL THEN 'PLATFORM'
          ELSE 'STORE'
        END
      WHERE scope_type IS NULL
         OR scope_type NOT IN ('PLATFORM', 'STORE')
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${couponsTable}
      SET scope_type = 'PLATFORM', store_id = NULL
      WHERE scope_type = 'PLATFORM'
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${couponsTable}
      SET scope_type = 'PLATFORM'
      WHERE store_id IS NULL
        AND scope_type <> 'PLATFORM'
    `);
  },

  async down(queryInterface) {
    const couponsTable = 'coupons';

    if (await indexExists(queryInterface, couponsTable, 'idx_coupons_scope_active')) {
      await queryInterface.removeIndex(couponsTable, 'idx_coupons_scope_active');
    }
    if (await indexExists(queryInterface, couponsTable, 'idx_coupons_store_id')) {
      await queryInterface.removeIndex(couponsTable, 'idx_coupons_store_id');
    }
    if (await indexExists(queryInterface, couponsTable, 'idx_coupons_scope_type')) {
      await queryInterface.removeIndex(couponsTable, 'idx_coupons_scope_type');
    }

    if (await columnExists(queryInterface, couponsTable, 'starts_at')) {
      await queryInterface.removeColumn(couponsTable, 'starts_at');
    }
    if (await columnExists(queryInterface, couponsTable, 'store_id')) {
      await queryInterface.removeColumn(couponsTable, 'store_id');
    }
    if (await columnExists(queryInterface, couponsTable, 'scope_type')) {
      await queryInterface.removeColumn(couponsTable, 'scope_type');
    }

    try {
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS scope_type;');
    } catch {
      // noop
    }
  },
};
