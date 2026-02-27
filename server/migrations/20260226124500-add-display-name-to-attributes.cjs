'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('attributes');
    if (!table['display_name']) {
      await queryInterface.addColumn('attributes', 'display_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('attributes');
    if (table['display_name']) {
      await queryInterface.removeColumn('attributes', 'display_name');
    }
  },
};

