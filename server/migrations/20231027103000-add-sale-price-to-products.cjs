module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    if (!table['sale_price']) {
      await queryInterface.addColumn('Products', 'sale_price', {
        type: Sequelize.DECIMAL(10,2),
        allowNull: true
      });
    }
  },
  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Products');
    if (table['sale_price']) {
      await queryInterface.removeColumn('Products', 'sale_price');
    }
  }
};
