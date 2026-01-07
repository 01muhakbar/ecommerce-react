// server/src/models/index.ts
import "dotenv/config";
import { Sequelize } from "sequelize";
import { initUser, User } from "./User.js";
import { Product } from "./Product.js";
// Gunakan ENV agar sinkron dengan phpMyAdmin/MySQL kamu
const sequelize = new Sequelize({
    dialect: "mysql",
    host: process.env.DB_HOST || "localhost",
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "ecommerce_dev",
    logging: false, // set true kalau mau lihat SQL di console
});
// Registrasi semua model di sini
function initModels() {
    initUser(sequelize);
    Product.initModel(sequelize);
    // TODO: init model lain (Product, Order, dsb) jika ada
    // contoh: initProduct(sequelize); Product.belongsTo(User) ... dst
}
// Jalankan init sekali waktu file ini di-import
initModels();
// Helper untuk sync schema → langsung terlihat di phpMyAdmin
export async function syncDb() {
    // gunakan alter agar kolom baru otomatis disesuaikan (aman untuk dev)
    await sequelize.sync({ alter: true });
}
export { sequelize, User, Product };
