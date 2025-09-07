'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('Products', 'status', {
      type: Sequelize.STRING,
      allowNull: true, // Sesuaikan dengan kebutuhan Anda
    });
    await queryInterface.addColumn('Products', 'gtin', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'promoImagePath', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'imagePaths', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'videoPath', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'youtubeLink', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'weight', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'length', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'width', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'height', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'dangerousProduct', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'preOrder', {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'preorderDays', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'condition', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'scheduledDisplay', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'parentSku', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'variations', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('Products', 'wholesale', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('Products', 'status');
    await queryInterface.removeColumn('Products', 'gtin');
    await queryInterface.removeColumn('Products', 'promoImagePath');
    await queryInterface.removeColumn('Products', 'imagePaths');
    await queryInterface.removeColumn('Products', 'videoPath');
    await queryInterface.removeColumn('Products', 'youtubeLink');
    await queryInterface.removeColumn('Products', 'weight');
    await queryInterface.removeColumn('Products', 'length');
    await queryInterface.removeColumn('Products', 'width');
    await queryInterface.removeColumn('Products', 'height');
    await queryInterface.removeColumn('Products', 'dangerousProduct');
    await queryInterface.removeColumn('Products', 'preOrder');
    await queryInterface.removeColumn('Products', 'preorderDays');
    await queryInterface.removeColumn('Products', 'condition');
    await queryInterface.removeColumn('Products', 'scheduledDisplay');
    await queryInterface.removeColumn('Products', 'parentSku');
    await queryInterface.removeColumn('Products', 'notes');
    await queryInterface.removeColumn('Products', 'variations');
    await queryInterface.removeColumn('Products', 'wholesale');
  }
};