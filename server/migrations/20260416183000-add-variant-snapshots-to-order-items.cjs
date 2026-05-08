'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'OrderItems';
    const table = await queryInterface.describeTable(tableName);

    if (!table['variantKey']) {
      await queryInterface.addColumn(tableName, 'variantKey', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table['variantLabel']) {
      await queryInterface.addColumn(tableName, 'variantLabel', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table['variantSelections']) {
      await queryInterface.addColumn(tableName, 'variantSelections', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table['skuSnapshot']) {
      await queryInterface.addColumn(tableName, 'skuSnapshot', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    if (!table['barcodeSnapshot']) {
      await queryInterface.addColumn(tableName, 'barcodeSnapshot', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
    if (!table['imageSnapshot']) {
      await queryInterface.addColumn(tableName, 'imageSnapshot', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'OrderItems';
    const table = await queryInterface.describeTable(tableName);

    if (table['imageSnapshot']) await queryInterface.removeColumn(tableName, 'imageSnapshot');
    if (table['barcodeSnapshot']) await queryInterface.removeColumn(tableName, 'barcodeSnapshot');
    if (table['skuSnapshot']) await queryInterface.removeColumn(tableName, 'skuSnapshot');
    if (table['variantSelections']) await queryInterface.removeColumn(tableName, 'variantSelections');
    if (table['variantLabel']) await queryInterface.removeColumn(tableName, 'variantLabel');
    if (table['variantKey']) await queryInterface.removeColumn(tableName, 'variantKey');
  },
};
