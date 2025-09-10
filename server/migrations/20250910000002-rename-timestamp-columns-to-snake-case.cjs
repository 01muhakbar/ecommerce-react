'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.renameColumn('Orders', 'createdAt', 'created_at');
    await queryInterface.renameColumn('Orders', 'updatedAt', 'updated_at');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.renameColumn('Orders', 'created_at', 'createdAt');
    await queryInterface.renameColumn('Orders', 'updated_at', 'updatedAt');
  }
};
