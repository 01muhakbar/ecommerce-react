'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Products');
    if (!table['categoryId']) {
      await queryInterface.addColumn('Products', 'categoryId', {
        type: Sequelize.INTEGER.UNSIGNED,
        references: {
          model: 'Categories',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('Products');
    if (table['categoryId']) {
      await queryInterface.removeColumn('Products', 'categoryId');
    }
  }
};