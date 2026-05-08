'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('attributes');

    if (!table['type']) {
      await queryInterface.addColumn('attributes', 'type', {
        type: Sequelize.ENUM('dropdown', 'radio', 'checkbox'),
        allowNull: false,
        defaultValue: 'dropdown',
      });
    }

    if (!table['published']) {
      await queryInterface.addColumn('attributes', 'published', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('attributes');

    if (table['published']) {
      await queryInterface.removeColumn('attributes', 'published');
    }

    if (table['type']) {
      await queryInterface.removeColumn('attributes', 'type');
    }
  },
};
