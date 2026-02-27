'use strict';

async function resolveUsersTable(queryInterface) {
  const candidates = ['users', 'Users'];
  for (const tableName of candidates) {
    try {
      await queryInterface.describeTable(tableName);
      return tableName;
    } catch {
      // try next table name
    }
  }
  throw new Error('Users table not found. Checked: users, Users');
}

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = await resolveUsersTable(queryInterface);
    const table = await queryInterface.describeTable(tableName);
    if (!table['is_published']) {
      await queryInterface.addColumn(tableName, 'is_published', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const tableName = await resolveUsersTable(queryInterface);
    const table = await queryInterface.describeTable(tableName);
    if (table['is_published']) {
      await queryInterface.removeColumn(tableName, 'is_published');
    }
  },
};
