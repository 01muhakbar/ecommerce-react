'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.changeColumn('Orders', 'status', {
      type: Sequelize.ENUM('pending', 'processing', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    });
  },

  async down (queryInterface, Sequelize) {
    // Reverting to a simple STRING is safer if other ENUMs were used before.
    // The original migration used STRING.
    await queryInterface.changeColumn('Orders', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'pending'
    });
  }
};