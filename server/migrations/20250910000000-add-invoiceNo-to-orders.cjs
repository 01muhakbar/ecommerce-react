'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders');
    if (!table['invoice_no']) {
      await queryInterface.addColumn('Orders', 'invoice_no', {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
        after: 'id' // Optional: to place the column after the 'id' column
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders');
    if (table['invoice_no']) {
      await queryInterface.removeColumn('Orders', 'invoice_no');
    }
  }
};