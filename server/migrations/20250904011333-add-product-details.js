'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // salePrice was added in a previous failed migration attempt. 
    // We are only adding the remaining columns here to fix the migration state.
    /* await queryInterface.addColumn('Products', 'salePrice', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    }); */
    await queryInterface.addColumn('Products', 'slug', {
      type: Sequelize.STRING,
      allowNull: true, // Temporarily allow nulls to run migration on existing data
      unique: true,
    });
    await queryInterface.addColumn('Products', 'tags', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Products', 'salePrice');
    await queryInterface.removeColumn('Products', 'slug');
    await queryInterface.removeColumn('Products', 'tags');
  }
};