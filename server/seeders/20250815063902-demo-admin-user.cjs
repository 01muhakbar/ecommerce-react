'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // More secure password for the Super Admin
    const hashedPassword = await bcrypt.hash('SuperAdmin_123!', 12);

    await queryInterface.bulkInsert('Users', [{
      name: 'Super Admin',
      email: 'super@admin.com',
      password: hashedPassword,
      role: 'Super Admin', // Match the ENUM definition
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    }], {});
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Users', { email: 'super@admin.com' }, {});
  }
};
