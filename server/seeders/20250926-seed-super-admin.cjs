'use strict';
const bcrypt = require("bcryptjs");

module.exports = {
  async up(queryInterface, Sequelize) {
    if (process.env.NODE_ENV === "production") {
      console.log("Skipping super admin seeder in production.");
      return;
    }

    const email = process.env.ADMIN_EMAIL || "super@admin.com";
    const pass  = process.env.ADMIN_PASSWORD || "supersecret123";
    const hash = await bcrypt.hash(pass, 10);

    // idempotent insert: hapus jika ada lalu insert lagi
    await queryInterface.bulkDelete("Staffs", { email });
    await queryInterface.bulkInsert("Staffs", [{
      name: "Super Admin",
      email,
      passwordHash: hash,
      contactNumber: null,
      joiningDate: new Date().toISOString().slice(0,10),
      role: "Super Admin",
      status: "Active",
      published: true,
      routes: JSON.stringify(["dashboard","catalog","customers","orders","our-staff","settings","international","online-store","pages"]), // Sequelize handles JSON, but bulkInsert expects a string for JSON fields
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  },
  async down(queryInterface, Sequelize) {
    const email = process.env.ADMIN_EMAIL || "super@admin.com";
    await queryInterface.bulkDelete("Staffs", { email });
  }
};
