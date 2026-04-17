'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'cart_items';
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
    if (!table['variant_sku_snapshot']) {
      await queryInterface.addColumn(tableName, 'variant_sku_snapshot', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    if (!table['variant_barcode_snapshot']) {
      await queryInterface.addColumn(tableName, 'variant_barcode_snapshot', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    if (!table['unit_price_snapshot']) {
      await queryInterface.addColumn(tableName, 'unit_price_snapshot', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }
    if (!table['unit_sale_price_snapshot']) {
      await queryInterface.addColumn(tableName, 'unit_sale_price_snapshot', {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      });
    }
    if (!table['variant_image_snapshot']) {
      await queryInterface.addColumn(tableName, 'variant_image_snapshot', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'cart_items';
    const table = await queryInterface.describeTable(tableName);

    if (table['variant_image_snapshot']) await queryInterface.removeColumn(tableName, 'variant_image_snapshot');
    if (table['unit_sale_price_snapshot']) await queryInterface.removeColumn(tableName, 'unit_sale_price_snapshot');
    if (table['unit_price_snapshot']) await queryInterface.removeColumn(tableName, 'unit_price_snapshot');
    if (table['variant_barcode_snapshot']) await queryInterface.removeColumn(tableName, 'variant_barcode_snapshot');
    if (table['variant_sku_snapshot']) await queryInterface.removeColumn(tableName, 'variant_sku_snapshot');
    if (table['variant_selections']) await queryInterface.removeColumn(tableName, 'variant_selections');
    if (table['variant_label']) await queryInterface.removeColumn(tableName, 'variant_label');
    if (table['variant_key']) await queryInterface.removeColumn(tableName, 'variant_key');
  },
};
