'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add slug column as nullable first
    await queryInterface.addColumn('Products', 'slug', {
      type: Sequelize.STRING,
      allowNull: true, // Temporarily allow null
      unique: true,
    });

    // Generate slugs for existing products
    // This is a simplified example. In a real app, you might want to generate
    // more meaningful slugs based on product names, ensuring uniqueness.
    await queryInterface.sequelize.query(
      `UPDATE Products SET slug = CONCAT('product-', id) WHERE slug IS NULL;`
    );

    // Change slug column to non-nullable
    await queryInterface.changeColumn('Products', 'slug', {
      type: Sequelize.STRING,
      allowNull: false, // Now enforce non-null
      unique: true,
    });

    await queryInterface.addColumn('Products', 'tags', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Products', 'slug');
    await queryInterface.removeColumn('Products', 'tags');
  }
};