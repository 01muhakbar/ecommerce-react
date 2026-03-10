"use strict";

async function tableExists(queryInterface, tableName) {
  try {
    await queryInterface.describeTable(tableName);
    return true;
  } catch {
    return false;
  }
}

async function columnExists(queryInterface, tableName, columnName) {
  try {
    const table = await queryInterface.describeTable(tableName);
    return Boolean(table?.[columnName]);
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, "stores"))) return;

    const columns = [
      ["description", { type: Sequelize.TEXT, allowNull: true }],
      ["logo_url", { type: Sequelize.STRING(2048), allowNull: true }],
      ["banner_url", { type: Sequelize.STRING(2048), allowNull: true }],
      ["email", { type: Sequelize.STRING(160), allowNull: true }],
      ["phone", { type: Sequelize.STRING(64), allowNull: true }],
      ["whatsapp", { type: Sequelize.STRING(64), allowNull: true }],
      ["website_url", { type: Sequelize.STRING(2048), allowNull: true }],
      ["instagram_url", { type: Sequelize.STRING(2048), allowNull: true }],
      ["tiktok_url", { type: Sequelize.STRING(2048), allowNull: true }],
      ["address_line_1", { type: Sequelize.STRING(255), allowNull: true }],
      ["address_line_2", { type: Sequelize.STRING(255), allowNull: true }],
      ["city", { type: Sequelize.STRING(120), allowNull: true }],
      ["province", { type: Sequelize.STRING(120), allowNull: true }],
      ["postal_code", { type: Sequelize.STRING(32), allowNull: true }],
      ["country", { type: Sequelize.STRING(120), allowNull: true }],
    ];

    for (const [columnName, definition] of columns) {
      if (await columnExists(queryInterface, "stores", columnName)) continue;
      await queryInterface.addColumn("stores", columnName, definition);
    }
  },

  async down(queryInterface) {
    if (!(await tableExists(queryInterface, "stores"))) return;

    const columns = [
      "country",
      "postal_code",
      "province",
      "city",
      "address_line_2",
      "address_line_1",
      "tiktok_url",
      "instagram_url",
      "website_url",
      "whatsapp",
      "phone",
      "email",
      "banner_url",
      "logo_url",
      "description",
    ];

    for (const columnName of columns) {
      if (!(await columnExists(queryInterface, "stores", columnName))) continue;
      await queryInterface.removeColumn("stores", columnName);
    }
  },
};
