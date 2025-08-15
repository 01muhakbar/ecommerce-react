"use strict";

const fs = require("fs");
const path = require("path");
const Sequelize = require("sequelize");
const process = require("process");
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
// Sesuaikan path ke file config.json Anda
const config = require(__dirname + "/../../config/config.json")[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

fs.readdirSync(__dirname) // Baca semua file di direktori saat ini (src/models)
  .filter((file) => {
    return (
      file.indexOf(".") !== 0 &&
      file !== basename &&
      file.slice(-3) === ".js" &&
      file.indexOf(".test.js") === -1
    );
  })
  .forEach((file) => {
    // Impor setiap model dan panggil dengan instance sequelize dan DataTypes
    const modelDefinition = require(path.join(__dirname, file));
    // Tambahkan pengecekan untuk memastikan yang diimpor adalah fungsi
    if (typeof modelDefinition === "function") {
      const model = modelDefinition(sequelize, Sequelize.DataTypes);
      db[model.name] = model;
    } else {
      console.warn(
        `[Model Loader] File ${file} diabaikan karena tidak mengekspor fungsi.`
      );
    }
  });

Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
