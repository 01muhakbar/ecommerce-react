import sequelize from "./SequelizeInstance";
// Import all models
import { User } from "./User";
import { Product } from "./Product";
import { Category } from "./Category";
import { Order } from "./Order";
import { OrderItem } from "./OrderItem";
import { Staff } from "./Staff";
import { Cart } from "./Cart";
import { CartItem } from "./CartItem";
import { Coupon } from "./Coupon";
import { Attribute } from "./Attribute";
/**
 * ----------------------------------------------------------------
 * Model Initialization and Export
 * ----------------------------------------------------------------
 */
// Initialize models
const models = [
    User,
    Product,
    Category,
    Order,
    OrderItem,
    Staff,
    Cart,
    CartItem,
    Coupon,
    Attribute,
];
// Initialize each model
models.forEach((model) => {
    if (model.initModel) {
        model.initModel(sequelize);
    }
});
// Create db object with all models
const db = {
    sequelize,
    User,
    Product,
    Category,
    Order,
    OrderItem,
    Staff,
    Cart,
    CartItem,
    Coupon,
    Attribute,
};
/**
 * ----------------------------------------------------------------
 * Model Associations
 * ----------------------------------------------------------------
 */
// Set up associations
models.forEach((model) => {
    if (model.associate && typeof model.associate === "function") {
        model.associate(db);
    }
});
export { sequelize, User, Product, Category, Order, OrderItem, Staff, Cart, CartItem, Coupon, Attribute, };
export default db;
