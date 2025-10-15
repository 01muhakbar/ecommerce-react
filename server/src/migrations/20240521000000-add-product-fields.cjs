"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tambah kolom jika belum ada
    const table = "products";

    await queryInterface.addColumn(table, "sku", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, "barcode", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, "salePrice", {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
    });
    await queryInterface.addColumn(table, "slug", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, "tags", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn(table, "imagePaths", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn(table, "isPublished", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn(table, "variations", {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn(table, "wholesale", {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Index tambahan yang umum dipakai
    await queryInterface.addIndex(table, ["sku"], {
      unique: true,
      name: "idx_products_sku",
    });
    await queryInterface.addIndex(table, ["slug"], {
      unique: true,
      name: "idx_products_slug",
    });
    await queryInterface.addIndex(table, ["category_id"], {
      name: "idx_products_categoryId",
    });
  },

  async down(queryInterface, _Sequelize) {
    const table = "products";
    await queryInterface
      .removeIndex(table, "idx_products_categoryId")
      .catch(() => {});
    await queryInterface
      .removeIndex(table, "idx_products_slug")
      .catch(() => {});
    await queryInterface.removeIndex(table, "idx_products_sku").catch(() => {});

    await queryInterface.removeColumn(table, "wholesale").catch(() => {});
    await queryInterface.removeColumn(table, "variations").catch(() => {});
    await queryInterface.removeColumn(table, "isPublished").catch(() => {});
    await queryInterface.removeColumn(table, "imagePaths").catch(() => {});
    await queryInterface.removeColumn(table, "tags").catch(() => {});
    await queryInterface.removeColumn(table, "slug").catch(() => {});
    await queryInterface.removeColumn(table, "salePrice").catch(() => {});
    await queryInterface.removeColumn(table, "barcode").catch(() => {});
    await queryInterface.removeColumn(table, "sku").catch(() => {});
  },
};
