'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Products', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER.UNSIGNED
      },
      product_name: { // Diubah ke snake_case
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      stock: { // diganti dari quantity ke stock
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      slug: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      created_at: { // Diubah ke snake_case
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: { // Diubah ke snake_case
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Products');
  }
};