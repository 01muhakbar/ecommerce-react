'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders');
    if (table['createdAt']) {
      await queryInterface.renameColumn('Orders', 'createdAt', 'created_at');
    }
    if (table['updatedAt']) {
      await queryInterface.renameColumn('Orders', 'updatedAt', 'updated_at');
    }
  },

  async down (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Orders');
    if (table['created_at']) {
      await queryInterface.renameColumn('Orders', 'created_at', 'createdAt');
    }
    if (table['updated_at']) {
      await queryInterface.renameColumn('Orders', 'updated_at', 'updatedAt');
    }
  }
};
