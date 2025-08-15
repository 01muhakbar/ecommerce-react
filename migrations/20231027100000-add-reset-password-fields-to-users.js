'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Menggunakan Promise.all untuk menjalankan beberapa operasi secara paralel
    await Promise.all([
      queryInterface.addColumn('Users', 'passwordResetToken', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'refreshToken' // Opsional: menempatkan kolom setelah kolom lain
      }),
      queryInterface.addColumn('Users', 'passwordResetExpires', {
        type: Sequelize.DATE,
        allowNull: true,
        after: 'passwordResetToken'
      })
    ]);
  },

  async down (queryInterface, Sequelize) {
    // Fungsi down harus mengembalikan perubahan yang dibuat oleh fungsi up
    await Promise.all([
      queryInterface.removeColumn('Users', 'passwordResetToken'),
      queryInterface.removeColumn('Users', 'passwordResetExpires')
    ]);
  }
};