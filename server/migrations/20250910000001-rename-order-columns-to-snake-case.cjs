'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders');
    if (table['userId']) {
      await queryInterface.renameColumn('Orders', 'userId', 'user_id');
    }
    if (table['totalAmount']) {
      await queryInterface.renameColumn('Orders', 'totalAmount', 'total_amount');
    }
  },

  async down (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders');
    if (table['user_id']) {
      await queryInterface.renameColumn('Orders', 'user_id', 'userId');
    }
    if (table['total_amount']) {
      await queryInterface.renameColumn('Orders', 'total_amount', 'totalAmount');
    }
  }
};
