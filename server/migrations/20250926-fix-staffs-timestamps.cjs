'use strict';

const { DataTypes } = require("sequelize");

module.exports = {
  async up(queryInterface, Sequelize) {
    console.log("Running migration to safely add timestamps to Staffs table...");
    const table = await queryInterface.describeTable("Staffs");

    // Tahap A: Tambah kolom nullable dulu (jika belum ada)
    if (!table.createdAt) {
      console.log("Adding nullable 'createdAt' column.");
      await queryInterface.addColumn("Staffs", "createdAt", { type: DataTypes.DATE, allowNull: true });
    }
    if (!table.updatedAt) {
      console.log("Adding nullable 'updatedAt' column.");
      await queryInterface.addColumn("Staffs", "updatedAt", { type: DataTypes.DATE, allowNull: true });
    }

    // Tahap B: Backfill nilai aman untuk baris lama
    console.log("Backfilling timestamps for existing rows...");
    await queryInterface.sequelize.query(`UPDATE Staffs SET createdAt = COALESCE(createdAt, NOW())`);
    await queryInterface.sequelize.query(`UPDATE Staffs SET updatedAt = COALESCE(updatedAt, NOW())`);

    // Tahap C: Kunci ke NOT NULL
    console.log("Changing timestamp columns to NOT NULL.");
    await queryInterface.changeColumn("Staffs", "createdAt", {
      type: DataTypes.DATE,
      allowNull: false,
    });
    await queryInterface.changeColumn("Staffs", "updatedAt", {
      type: DataTypes.DATE,
      allowNull: false,
    });
    console.log("Timestamp migration complete.");
  },

  async down(queryInterface, Sequelize) {
    console.log("Reverting timestamp migration...");
    await queryInterface.removeColumn("Staffs", "updatedAt");
    await queryInterface.removeColumn("Staffs", "createdAt");
    console.log("Timestamp migration reverted.");
  },
};
