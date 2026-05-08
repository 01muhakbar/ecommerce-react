'use strict';

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
    const definition = await queryInterface.describeTable(tableName);
    return Boolean(definition?.[columnName]);
  } catch {
    return false;
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const couponsTable = 'coupons';
    if (!(await tableExists(queryInterface, couponsTable))) return;

    if (!(await columnExists(queryInterface, couponsTable, 'campaign_name'))) {
      await queryInterface.addColumn(couponsTable, 'campaign_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      UPDATE ${couponsTable}
      SET campaign_name = COALESCE(NULLIF(TRIM(campaign_name), ''), code)
      WHERE campaign_name IS NULL OR TRIM(campaign_name) = ''
    `);

    await queryInterface.sequelize.query(`
      UPDATE ${couponsTable}
      SET
        amount = ROUND(COALESCE(amount, 0), 0),
        min_spend = ROUND(COALESCE(min_spend, 0), 0)
    `);
  },

  async down(queryInterface) {
    const couponsTable = 'coupons';
    if (await columnExists(queryInterface, couponsTable, 'campaign_name')) {
      await queryInterface.removeColumn(couponsTable, 'campaign_name');
    }
  },
};
