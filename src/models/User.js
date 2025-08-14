// src/models/User.js
const { DataTypes } = require("sequelize");
const sequelize = require("../../config/database");

const User = sequelize.define("User", {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true, // Setiap email harus unik
    validate: {
      isEmail: true, // Validasi format email
    },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "pembeli", // Role default saat registrasi biasa
    validate: {
      isIn: [["pembeli", "penjual", "admin"]], // Hanya menerima 3 nilai ini
    },
  },

  storeName: {
    type: DataTypes.STRING,
    allowNull: true, // Izinkan kosong untuk pembeli
  },
});

module.exports = User;
