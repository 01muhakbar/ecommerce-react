'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'suborder_items';
    const table = await queryInterface.describeTable(tableName);

    if (!table['variant_key']) {
      await queryInterface.addColumn(tableName, 'variant_key', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table['variant_label']) {
      await queryInterface.addColumn(tableName, 'variant_label', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table['variant_selections']) {
      await queryInterface.addColumn(tableName, 'variant_selections', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table['barcode_snapshot']) {
      await queryInterface.addColumn(tableName, 'barcode_snapshot', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    if (!table['image_snapshot']) {
      await queryInterface.addColumn(tableName, 'image_snapshot', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'suborder_items';
    const table = await queryInterface.describeTable(tableName);

    if (table['image_snapshot']) await queryInterface.removeColumn(tableName, 'image_snapshot');
    if (table['barcode_snapshot']) await queryInterface.removeColumn(tableName, 'barcode_snapshot');
    if (table['variant_selections']) await queryInterface.removeColumn(tableName, 'variant_selections');
    if (table['variant_label']) await queryInterface.removeColumn(tableName, 'variant_label');
    if (table['variant_key']) await queryInterface.removeColumn(tableName, 'variant_key');
  },
};
