"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("Orders");
    if (!table["shipping_details"] && !table["shippingDetails"]) {
      await queryInterface.addColumn("Orders", "shipping_details", {
        type: Sequelize.JSON,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("Orders");
    if (table["shipping_details"]) {
      await queryInterface.removeColumn("Orders", "shipping_details");
    } else if (table["shippingDetails"]) {
      await queryInterface.removeColumn("Orders", "shippingDetails");
    }
  },
};
