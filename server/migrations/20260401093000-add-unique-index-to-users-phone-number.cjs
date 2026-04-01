'use strict';

async function resolveUsersTable(queryInterface) {
  for (const candidate of ['users', 'Users']) {
    try {
      await queryInterface.describeTable(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return 'users';
}

module.exports = {
  async up(queryInterface) {
    const tableName = await resolveUsersTable(queryInterface);
    await queryInterface.addIndex(tableName, ['phone_number'], {
      name: 'users_phone_number_unique',
      unique: true,
    });
  },

  async down(queryInterface) {
    const tableName = await resolveUsersTable(queryInterface);
    await queryInterface.removeIndex(tableName, 'users_phone_number_unique');
  },
};
