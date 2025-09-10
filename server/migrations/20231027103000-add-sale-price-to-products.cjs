'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Menambahkan kolom 'sale_price' ke tabel 'Products'.
     */
    await queryInterface.addColumn('Products', 'sale_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'price' // Opsional: menempatkan kolom ini setelah kolom 'price' agar lebih rapi.
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Menghapus kolom 'sale_price' dari tabel 'Products' jika migrasi di-rollback.
     */
    await queryInterface.removeColumn('Products', 'sale_price');
  }
};
