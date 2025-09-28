'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (!table['joined_at']) {
      await queryInterface.addColumn('Users', 'joined_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
    if (!table['allowed_routes']) {
      await queryInterface.addColumn('Users', 'allowed_routes', {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
    if (!table['avatar_url']) {
      await queryInterface.addColumn('Users', 'avatar_url', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Users');
    if (table['joined_at']) {
      await queryInterface.removeColumn('Users', 'joined_at');
    }
    if (table['allowed_routes']) {
      await queryInterface.removeColumn('Users', 'allowed_routes');
    }
    if (table['avatar_url']) {
      await queryInterface.removeColumn('Users', 'avatar_url');
    }
  }
};