import { Sequelize } from "sequelize";
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

interface ModelType {
  initModel?(sequelize: Sequelize): void;
  associate?(db: any): void;
}

interface DB {
  sequelize: typeof sequelize;
  User: typeof User & ModelType;
  Product: typeof Product & ModelType;
  Category: typeof Category & ModelType;
  Order: typeof Order & ModelType;
  OrderItem: typeof OrderItem & ModelType;
  Staff: typeof Staff & ModelType;
  Cart: typeof Cart & ModelType;
  CartItem: typeof CartItem & ModelType;
  Coupon: typeof Coupon & ModelType;
  Attribute: typeof Attribute & ModelType;
  [key: string]: any;
}

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
] as (typeof User & ModelType)[];

// Initialize each model
models.forEach((model) => {
  if (model.initModel) {
    model.initModel(sequelize);
  }
});

// Create db object with all models
const db: DB = {
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

export {
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

export default db;
