'use strict';

async function resolveProductsTableName(queryInterface) {
  for (const candidate of ['Products', 'products']) {
    try {
      await queryInterface.describeTable(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  throw new Error('Products table was not found.');
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = await resolveProductsTableName(queryInterface);
    const table = await queryInterface.describeTable(tableName);
    if (!table['seo']) {
      await queryInterface.addColumn(tableName, 'seo', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = await resolveProductsTableName(queryInterface);
    const table = await queryInterface.describeTable(tableName);
    if (table['seo']) {
      await queryInterface.removeColumn(tableName, 'seo');
    }
  },
};
