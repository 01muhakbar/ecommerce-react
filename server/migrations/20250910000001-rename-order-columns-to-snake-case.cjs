'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameColumn('Orders', 'userId', 'user_id');
    await queryInterface.renameColumn('Orders', 'totalAmount', 'total_amount');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameColumn('Orders', 'user_id', 'userId');
    await queryInterface.renameColumn('Orders', 'total_amount', 'totalAmount');
  }
};
