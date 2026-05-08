'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'CartItems';

    await queryInterface.addColumn(tableName, 'variant_key', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'variant_label', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'variant_selections', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'variant_sku_snapshot', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'variant_barcode_snapshot', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'unit_price_snapshot', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'unit_sale_price_snapshot', {
      type: Sequelize.DECIMAL(12, 2),
      allowNull: true,
    });
    await queryInterface.addColumn(tableName, 'variant_image_snapshot', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    const tableName = 'CartItems';

    await queryInterface.removeColumn(tableName, 'variant_image_snapshot');
    await queryInterface.removeColumn(tableName, 'unit_sale_price_snapshot');
    await queryInterface.removeColumn(tableName, 'unit_price_snapshot');
    await queryInterface.removeColumn(tableName, 'variant_barcode_snapshot');
    await queryInterface.removeColumn(tableName, 'variant_sku_snapshot');
    await queryInterface.removeColumn(tableName, 'variant_selections');
    await queryInterface.removeColumn(tableName, 'variant_label');
    await queryInterface.removeColumn(tableName, 'variant_key');
  },
};
