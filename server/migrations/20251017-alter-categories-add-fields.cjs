'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Categories');
    if (!table['code']) {
      await queryInterface.addColumn('Categories', 'code', {
        type: Sequelize.STRING(32),
        allowNull: false,
        unique: true,
      });
    }
    if (!table['icon']) {
      await queryInterface.addColumn('Categories', 'icon', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
    if (!table['published']) {
      await queryInterface.addColumn('Categories', 'published', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
    if (!table['parent_id']) {
      await queryInterface.addColumn('Categories', 'parent_id', {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: 'Categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('Categories', ['parent_id'], { name: 'categories_parent_idx' });
    }
    // ensure name length
    await queryInterface.changeColumn('Categories', 'name', { type: Sequelize.STRING(120), allowNull: false });
    // description length
    if (table['description']) {
      await queryInterface.changeColumn('Categories', 'description', { type: Sequelize.STRING(255), allowNull: true });
    }
    // unique index on code
    const idx = await queryInterface.showIndex('Categories');
    if (!idx.find(i => i.name === 'categories_code_unique')) {
      await queryInterface.addIndex('Categories', ['code'], { unique: true, name: 'categories_code_unique' });
    }
  },
  async down(queryInterface, Sequelize) {
    const idx = await queryInterface.showIndex('Categories');
    if (idx.find(i => i.name === 'categories_code_unique')) {
      await queryInterface.removeIndex('Categories', 'categories_code_unique');
    }
    await queryInterface.removeIndex('Categories', 'categories_parent_idx').catch(() => {});
    await queryInterface.removeColumn('Categories', 'parent_id').catch(() => {});
    await queryInterface.removeColumn('Categories', 'published').catch(() => {});
    await queryInterface.removeColumn('Categories', 'icon').catch(() => {});
    await queryInterface.removeColumn('Categories', 'code').catch(() => {});
  }
};

