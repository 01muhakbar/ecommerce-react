// d:\project-ecommerce\migrations\xxxxxxxxxxxxxx-add-role-to-users.js
"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Users", "role", {
      type: Sequelize.ENUM("pembeli", "penjual", "admin"),
      allowNull: false,
      defaultValue: "pembeli",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Users", "role");
    // Jika Anda menggunakan PostgreSQL, Anda juga perlu menghapus tipe ENUM secara manual
    // await queryInterface.sequelize.query('DROP TYPE "enum_Users_role";');
  },
};
