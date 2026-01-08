// server/src/models/index.ts
import "dotenv/config";
import { Sequelize } from "sequelize";
import { initUser, User } from "./User.ts";
import { Product } from "./Product.ts";
import { Category } from "./Category.ts";
import { Cart } from "./Cart.ts";
import { CartItem } from "./CartItem.ts";
import { Order } from "./Order.ts";
import { OrderItem } from "./OrderItem.ts";

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
  Category.initModel(sequelize);
  Cart.initModel(sequelize);
  CartItem.initModel(sequelize);
  Order.initModel(sequelize);
  OrderItem.initModel(sequelize);

  const models: any = {
    User,
    Product,
    Category,
    Cart,
    CartItem,
    Order,
    OrderItem,
  };

  Object.values(models).forEach((model: any) => {
    if (typeof model.associate === "function") {
      model.associate(models);
    }
  });
}

// Jalankan init sekali waktu file ini di-import
initModels();

// Helper untuk sync schema → langsung terlihat di phpMyAdmin
export async function syncDb() {
  // gunakan alter agar kolom baru otomatis disesuaikan (aman untuk dev)
  await sequelize.sync({ alter: true });
}

export { sequelize, User, Product, Category, Cart, CartItem, Order, OrderItem };
