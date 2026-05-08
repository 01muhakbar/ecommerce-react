'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    if (!table['barcode']) {
      await queryInterface.addColumn('Products', 'barcode', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    if (table['barcode']) {
      await queryInterface.removeColumn('Products', 'barcode');
    }
  }
};
