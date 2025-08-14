// config/database.js
const {
  Sequelize
} = require('sequelize');

// Pastikan dotenv sudah di-require di file utama (index.js) Anda
// agar process.env bisa membaca file .env
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    dialect: 'mysql' // Pastikan ini adalah 'mysql'
  }
);

module.exports = sequelize;