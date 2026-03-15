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

async function removeIndexesByStoreIdUniqueness(queryInterface, tableName) {
  try {
    const indexes = await queryInterface.showIndex(tableName);
    const uniqueStoreIndexes = indexes.filter((index) => {
      const fieldNames = Array.isArray(index.fields)
        ? index.fields.map((field) => String(field.attribute || field.name || '').toLowerCase())
        : [];
      return (
        index.unique === true &&
        String(index.name || '').toUpperCase() !== 'PRIMARY' &&
        fieldNames.length === 1 &&
        fieldNames[0] === 'store_id'
      );
    });

    for (const index of uniqueStoreIndexes) {
      await queryInterface.removeIndex(tableName, index.name);
    }
  } catch {
    // noop
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const storesTable = 'stores';
    const profilesTable = 'store_payment_profiles';
    const requestsTable = 'store_payment_profile_requests';

    if (!(await tableExists(queryInterface, storesTable))) return;
    if (!(await tableExists(queryInterface, profilesTable))) return;

    if (!(await tableExists(queryInterface, requestsTable))) {
      await queryInterface.createTable(requestsTable, {
        id: {
          type: Sequelize.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        store_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: false,
          references: {
            model: storesTable,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        based_on_profile_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: profilesTable,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        request_status: {
          type: Sequelize.ENUM(
            'DRAFT',
            'SUBMITTED',
            'NEEDS_REVISION',
            'REJECTED',
            'APPROVED',
            'PROMOTED'
          ),
          allowNull: false,
          defaultValue: 'DRAFT',
        },
        account_name: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        merchant_name: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        merchant_id: {
          type: Sequelize.STRING(160),
          allowNull: true,
        },
        qris_image_url: {
          type: Sequelize.TEXT('long'),
          allowNull: true,
        },
        qris_payload: {
          type: Sequelize.TEXT('long'),
          allowNull: true,
        },
        instruction_text: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        seller_note: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        admin_review_note: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        submitted_by_user_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        submitted_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        reviewed_by_admin_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: 'users',
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        reviewed_at: {
          type: Sequelize.DATE,
          allowNull: true,
        },
        promoted_profile_id: {
          type: Sequelize.INTEGER.UNSIGNED,
          allowNull: true,
          references: {
            model: profilesTable,
            key: 'id',
          },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
      });
    }

    await addIndexIfMissing(queryInterface, requestsTable, ['store_id'], {
      name: 'idx_sppr_store_id',
    });
    await addIndexIfMissing(queryInterface, requestsTable, ['request_status'], {
      name: 'idx_sppr_request_status',
    });
    await addIndexIfMissing(queryInterface, requestsTable, ['promoted_profile_id'], {
      name: 'idx_sppr_promoted_profile_id',
    });

    if (!(await columnExists(queryInterface, storesTable, 'active_store_payment_profile_id'))) {
      await queryInterface.addColumn(storesTable, 'active_store_payment_profile_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: profilesTable,
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
    await addIndexIfMissing(queryInterface, storesTable, ['active_store_payment_profile_id'], {
      name: 'idx_stores_active_store_payment_profile_id',
    });

    if (!(await columnExists(queryInterface, profilesTable, 'version'))) {
      await queryInterface.addColumn(profilesTable, 'version', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
      });
    }

    if (!(await columnExists(queryInterface, profilesTable, 'snapshot_status'))) {
      await queryInterface.addColumn(profilesTable, 'snapshot_status', {
        type: Sequelize.ENUM('ACTIVE', 'SUPERSEDED', 'INACTIVE'),
        allowNull: false,
        defaultValue: 'INACTIVE',
      });
    }

    if (!(await columnExists(queryInterface, profilesTable, 'source_request_id'))) {
      await queryInterface.addColumn(profilesTable, 'source_request_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: requestsTable,
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, profilesTable, 'activated_by_admin_id'))) {
      await queryInterface.addColumn(profilesTable, 'activated_by_admin_id', {
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

    if (!(await columnExists(queryInterface, profilesTable, 'activated_at'))) {
      await queryInterface.addColumn(profilesTable, 'activated_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!(await columnExists(queryInterface, profilesTable, 'superseded_by_profile_id'))) {
      await queryInterface.addColumn(profilesTable, 'superseded_by_profile_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: profilesTable,
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!(await columnExists(queryInterface, profilesTable, 'superseded_at'))) {
      await queryInterface.addColumn(profilesTable, 'superseded_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    await addIndexIfMissing(queryInterface, profilesTable, ['store_id', 'snapshot_status'], {
      name: 'idx_spp_store_snapshot_status',
    });
    await addIndexIfMissing(queryInterface, profilesTable, ['source_request_id'], {
      name: 'idx_spp_source_request_id',
    });

    await removeIndexesByStoreIdUniqueness(queryInterface, profilesTable);

    await queryInterface.sequelize.query(`
      UPDATE ${profilesTable}
      SET
        version = COALESCE(NULLIF(version, 0), 1),
        snapshot_status = CASE
          WHEN is_active = 1 AND UPPER(COALESCE(verification_status, '')) = 'ACTIVE' THEN 'ACTIVE'
          ELSE 'INACTIVE'
        END,
        activated_by_admin_id = CASE
          WHEN activated_by_admin_id IS NULL AND is_active = 1 AND UPPER(COALESCE(verification_status, '')) = 'ACTIVE'
            THEN verified_by_admin_id
          ELSE activated_by_admin_id
        END,
        activated_at = CASE
          WHEN activated_at IS NULL AND is_active = 1 AND UPPER(COALESCE(verification_status, '')) = 'ACTIVE'
            THEN COALESCE(verified_at, updated_at, created_at, NOW())
          ELSE activated_at
        END
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${storesTable} s
      LEFT JOIN (
        SELECT p.store_id, MAX(p.id) AS active_profile_id
        FROM ${profilesTable} p
        WHERE p.is_active = 1
          AND UPPER(COALESCE(p.verification_status, '')) = 'ACTIVE'
        GROUP BY p.store_id
      ) active_profiles ON active_profiles.store_id = s.id
      SET s.active_store_payment_profile_id = active_profiles.active_profile_id
      WHERE active_profiles.active_profile_id IS NOT NULL
    `);
  },

  async down(queryInterface, Sequelize) {
    const storesTable = 'stores';
    const profilesTable = 'store_payment_profiles';
    const requestsTable = 'store_payment_profile_requests';

    if (await indexExists(queryInterface, profilesTable, 'idx_spp_source_request_id')) {
      await queryInterface.removeIndex(profilesTable, 'idx_spp_source_request_id');
    }
    if (await indexExists(queryInterface, profilesTable, 'idx_spp_store_snapshot_status')) {
      await queryInterface.removeIndex(profilesTable, 'idx_spp_store_snapshot_status');
    }

    if (await columnExists(queryInterface, profilesTable, 'superseded_at')) {
      await queryInterface.removeColumn(profilesTable, 'superseded_at');
    }
    if (await columnExists(queryInterface, profilesTable, 'superseded_by_profile_id')) {
      await queryInterface.removeColumn(profilesTable, 'superseded_by_profile_id');
    }
    if (await columnExists(queryInterface, profilesTable, 'activated_at')) {
      await queryInterface.removeColumn(profilesTable, 'activated_at');
    }
    if (await columnExists(queryInterface, profilesTable, 'activated_by_admin_id')) {
      await queryInterface.removeColumn(profilesTable, 'activated_by_admin_id');
    }
    if (await columnExists(queryInterface, profilesTable, 'source_request_id')) {
      await queryInterface.removeColumn(profilesTable, 'source_request_id');
    }
    if (await columnExists(queryInterface, profilesTable, 'snapshot_status')) {
      await queryInterface.removeColumn(profilesTable, 'snapshot_status');
    }
    if (await columnExists(queryInterface, profilesTable, 'version')) {
      await queryInterface.removeColumn(profilesTable, 'version');
    }

    if (await indexExists(queryInterface, storesTable, 'idx_stores_active_store_payment_profile_id')) {
      await queryInterface.removeIndex(storesTable, 'idx_stores_active_store_payment_profile_id');
    }
    if (await columnExists(queryInterface, storesTable, 'active_store_payment_profile_id')) {
      await queryInterface.removeColumn(storesTable, 'active_store_payment_profile_id');
    }

    if (await indexExists(queryInterface, requestsTable, 'idx_sppr_promoted_profile_id')) {
      await queryInterface.removeIndex(requestsTable, 'idx_sppr_promoted_profile_id');
    }
    if (await indexExists(queryInterface, requestsTable, 'idx_sppr_request_status')) {
      await queryInterface.removeIndex(requestsTable, 'idx_sppr_request_status');
    }
    if (await indexExists(queryInterface, requestsTable, 'idx_sppr_store_id')) {
      await queryInterface.removeIndex(requestsTable, 'idx_sppr_store_id');
    }
    if (await tableExists(queryInterface, requestsTable)) {
      await queryInterface.dropTable(requestsTable);
    }

    if (!(await indexExists(queryInterface, profilesTable, 'uniq_store_payment_profiles_store_id'))) {
      try {
        await queryInterface.addIndex(profilesTable, ['store_id'], {
          name: 'uniq_store_payment_profiles_store_id',
          unique: true,
        });
      } catch {
        // noop
      }
    }

    try {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS request_status;`);
    } catch {
      // noop
    }
    try {
      await queryInterface.sequelize.query(`DROP TYPE IF EXISTS snapshot_status;`);
    } catch {
      // noop
    }
  },
};
