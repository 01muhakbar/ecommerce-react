'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("Staffs", {
      id: { type: Sequelize.DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      name: { type: Sequelize.DataTypes.STRING(120), allowNull: false },
      email: { type: Sequelize.DataTypes.STRING(160), allowNull: false, unique: true },
      passwordHash: { type: Sequelize.DataTypes.STRING(180), allowNull: false },
      contactNumber: { type: Sequelize.DataTypes.STRING(40) },
      joiningDate: { type: Sequelize.DataTypes.DATEONLY },
      role: { type: Sequelize.DataTypes.STRING(40), allowNull: false, defaultValue: "Staff" },
      routes: { type: Sequelize.DataTypes.JSON, allowNull: false, defaultValue: [] },
      avatarUrl: { type: Sequelize.DataTypes.STRING(255) },
      status: { type: Sequelize.DataTypes.STRING, defaultValue: 'Inactive', allowNull: false },
      published: { type: Sequelize.DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      createdAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.DataTypes.NOW },
      updatedAt: { type: Sequelize.DataTypes.DATE, allowNull: false, defaultValue: Sequelize.DataTypes.NOW },
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("Staffs");
  },
};