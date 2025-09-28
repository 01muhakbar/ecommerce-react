'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    const columnsToAdd = {
      status: { type: Sequelize.STRING, allowNull: true },
      gtin: { type: Sequelize.STRING, allowNull: true },
      promoImagePath: { type: Sequelize.STRING, allowNull: true },
      imagePaths: { type: Sequelize.JSON, allowNull: true },
      videoPath: { type: Sequelize.STRING, allowNull: true },
      youtubeLink: { type: Sequelize.STRING, allowNull: true },
      weight: { type: Sequelize.INTEGER, allowNull: true },
      length: { type: Sequelize.INTEGER, allowNull: true },
      width: { type: Sequelize.INTEGER, allowNull: true },
      height: { type: Sequelize.INTEGER, allowNull: true },
      dangerousProduct: { type: Sequelize.BOOLEAN, allowNull: true },
      preOrder: { type: Sequelize.BOOLEAN, allowNull: true },
      preorderDays: { type: Sequelize.INTEGER, allowNull: true },
      condition: { type: Sequelize.STRING, allowNull: true },
      scheduledDisplay: { type: Sequelize.DATE, allowNull: true },
      parentSku: { type: Sequelize.STRING, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      variations: { type: Sequelize.JSON, allowNull: true },
      wholesale: { type: Sequelize.JSON, allowNull: true },
    };

    for (const columnName in columnsToAdd) {
      if (!table[columnName]) {
        await queryInterface.addColumn('Products', columnName, columnsToAdd[columnName]);
      }
    }
  },

  async down (queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    const columnsToRemove = [
      'status', 'gtin', 'promoImagePath', 'imagePaths', 'videoPath', 'youtubeLink', 'weight', 'length', 'width', 'height',
      'dangerousProduct', 'preOrder', 'preorderDays', 'condition', 'scheduledDisplay', 'parentSku', 'notes', 'variations', 'wholesale'
    ];

    for (const columnName of columnsToRemove) {
      if (table[columnName]) {
        await queryInterface.removeColumn('Products', columnName);
      }
    }
  }
};