'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add a unique index on Categories.name
    await queryInterface.addIndex('Categories', ['name'], {
      unique: true,
      name: 'categories_name_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove the unique index
    await queryInterface.removeIndex('Categories', 'categories_name_unique');
  },
};

