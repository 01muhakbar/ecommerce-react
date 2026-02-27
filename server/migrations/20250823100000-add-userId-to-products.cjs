'use strict';

const FK_NAME = 'Products_userId_foreign_idx';

async function resolveTableName(queryInterface, candidates, required = true) {
  for (const tableName of candidates) {
    try {
      await queryInterface.describeTable(tableName);
      return tableName;
    } catch {
      // try next candidate
    }
  }
  if (required) {
    throw new Error(`Table not found. Checked: ${candidates.join(', ')}`);
  }
  return null;
}

async function getColumnInfo(queryInterface, tableName, columnName) {
  const table = await queryInterface.describeTable(tableName);
  return table[columnName] || null;
}

async function getUserIdForeignKeys(queryInterface, productsTable, transaction) {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT
        kcu.CONSTRAINT_NAME AS constraintName,
        rc.DELETE_RULE AS deleteRule,
        rc.UPDATE_RULE AS updateRule
      FROM information_schema.KEY_COLUMN_USAGE kcu
      INNER JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
       AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = :productsTable
        AND kcu.COLUMN_NAME = 'userId'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `,
    {
      replacements: { productsTable },
      transaction,
    }
  );
  return Array.isArray(rows) ? rows : [];
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const productsTable = await resolveTableName(queryInterface, ['Products', 'products']);
    const usersTable = await resolveTableName(queryInterface, ['Users', 'users']);

    await queryInterface.sequelize.transaction(async (transaction) => {
      const userIdColumn = await getColumnInfo(queryInterface, productsTable, 'userId');

      // Step 1: ensure column exists and is nullable so legacy rows stay safe.
      if (!userIdColumn) {
        await queryInterface.addColumn(
          productsTable,
          'userId',
          {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: true,
          },
          { transaction }
        );
      } else if (userIdColumn.allowNull === false) {
        await queryInterface.changeColumn(
          productsTable,
          'userId',
          {
            type: Sequelize.INTEGER.UNSIGNED,
            allowNull: true,
          },
          { transaction }
        );
      }

      // Step 2: backfill invalid legacy references to NULL (safe default).
      await queryInterface.sequelize.query(
        `
          UPDATE \`${productsTable}\` p
          LEFT JOIN \`${usersTable}\` u ON p.userId = u.id
          SET p.userId = NULL
          WHERE p.userId IS NOT NULL
            AND u.id IS NULL
        `,
        { transaction }
      );

      // Step 3: ensure FK exists with ON DELETE SET NULL / ON UPDATE CASCADE.
      const existingForeignKeys = await getUserIdForeignKeys(
        queryInterface,
        productsTable,
        transaction
      );
      const hasDesiredForeignKey = existingForeignKeys.some(
        (fk) =>
          String(fk.deleteRule).toUpperCase() === 'SET NULL' &&
          String(fk.updateRule).toUpperCase() === 'CASCADE'
      );

      if (!hasDesiredForeignKey) {
        for (const fk of existingForeignKeys) {
          await queryInterface.removeConstraint(productsTable, fk.constraintName, {
            transaction,
          });
        }

        await queryInterface.addConstraint(productsTable, {
          fields: ['userId'],
          type: 'foreign key',
          name: FK_NAME,
          references: {
            table: usersTable,
            field: 'id',
          },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
          transaction,
        });
      }
    });
  },

  down: async (queryInterface, Sequelize) => {
    const productsTable = await resolveTableName(queryInterface, ['Products', 'products'], false);
    if (!productsTable) return;

    await queryInterface.sequelize.transaction(async (transaction) => {
      const userIdColumn = await getColumnInfo(queryInterface, productsTable, 'userId');
      if (!userIdColumn) return;

      const foreignKeys = await getUserIdForeignKeys(queryInterface, productsTable, transaction);
      for (const fk of foreignKeys) {
        await queryInterface.removeConstraint(productsTable, fk.constraintName, {
          transaction,
        });
      }

      await queryInterface.removeColumn(productsTable, 'userId', { transaction });
    });
  }
};
