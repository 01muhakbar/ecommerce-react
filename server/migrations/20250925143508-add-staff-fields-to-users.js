'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'joined_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'allowed_routes', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Users', 'avatar_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'joined_at');
    await queryInterface.removeColumn('Users', 'allowed_routes');
    await queryInterface.removeColumn('Users', 'avatar_url');
  }
};