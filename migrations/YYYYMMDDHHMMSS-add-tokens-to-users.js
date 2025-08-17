"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Menggunakan Promise.all untuk menjalankan semua operasi secara paralel
    await Promise.all([
      queryInterface.addColumn("Users", "refreshToken", {
        type: Sequelize.TEXT, // TEXT lebih cocok untuk token yang bisa panjang
        allowNull: true,
      }),
      queryInterface.addColumn("Users", "passwordResetToken", {
        type: Sequelize.STRING,
        allowNull: true,
      }),
      queryInterface.addColumn("Users", "passwordResetExpires", {
        type: Sequelize.DATE,
        allowNull: true,
      }),
    ]);
  },

  async down(queryInterface, Sequelize) {
    // Fungsi down untuk membatalkan migrasi
    await Promise.all([
      queryInterface.removeColumn("Users", "refreshToken"),
      queryInterface.removeColumn("Users", "passwordResetToken"),
      queryInterface.removeColumn("Users", "passwordResetExpires"),
    ]);
  },
};
