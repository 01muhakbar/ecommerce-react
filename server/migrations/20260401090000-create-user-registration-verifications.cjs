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
  async up(queryInterface, Sequelize) {
    const usersTable = await resolveUsersTable(queryInterface);
    await queryInterface.createTable('user_registration_verifications', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: usersTable,
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      public_id: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      channel: {
        type: Sequelize.STRING(16),
        allowNull: false,
        defaultValue: 'EMAIL',
      },
      status: {
        type: Sequelize.STRING(32),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      otp_hash: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      otp_expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      resend_available_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      last_sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      attempts: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      max_attempts: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 5,
      },
      resend_count: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      max_resends: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 5,
      },
      verified_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      consumed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_attempt_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      blocked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_delivery_error: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('user_registration_verifications', ['user_id'], {
      name: 'user_registration_verifications_user_id_idx',
    });
    await queryInterface.addIndex('user_registration_verifications', ['status'], {
      name: 'user_registration_verifications_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_registration_verifications');
  },
};
