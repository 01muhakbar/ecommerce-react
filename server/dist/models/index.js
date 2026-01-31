// server/src/models/index.ts
import "dotenv/config";
import sequelize from "../config/database.js";
import { initUser, User } from "./User.js";
import { Product } from "./Product.js";
import { Category } from "./Category.js";
import { Cart } from "./Cart.js";
import { CartItem } from "./CartItem.js";
import { Order } from "./Order.js";
import { OrderItem } from "./OrderItem.js";
import { Coupon } from "./Coupon.js";
// Registrasi semua model di sini
function initModels() {
    initUser(sequelize);
    Product.initModel(sequelize);
    Category.initModel(sequelize);
    Cart.initModel(sequelize);
    CartItem.initModel(sequelize);
    Order.initModel(sequelize);
    OrderItem.initModel(sequelize);
    Coupon.initModel(sequelize);
    const models = {
        User,
        Product,
        Category,
        Cart,
        CartItem,
        Order,
        OrderItem,
        Coupon,
    };
    Object.values(models).forEach((model) => {
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
// Dev-only reset: drop & recreate tables to clean legacy data issues.
export async function resetDbDev() {
    if (process.env.NODE_ENV === "production") {
        throw new Error("resetDbDev is disabled in production.");
    }
    await sequelize.authenticate();
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");
    try {
        await sequelize.drop();
        await sequelize.sync({ force: true });
    }
    finally {
        await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
    }
}
export { sequelize, User, Product, Category, Cart, CartItem, Order, OrderItem, Coupon };
