'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'sku', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'barcode', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Products', 'sku');
    await queryInterface.removeColumn('Products', 'barcode');
  }
};
