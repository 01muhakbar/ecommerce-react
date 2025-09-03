"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderItem = exports.Order = exports.Category = exports.CartItem = exports.Cart = exports.Product = exports.User = exports.Sequelize = exports.sequelize = void 0;
const sequelize_1 = require("sequelize");
Object.defineProperty(exports, "Sequelize", { enumerable: true, get: function () { return sequelize_1.Sequelize; } });
const User_1 = require("./User");
Object.defineProperty(exports, "User", { enumerable: true, get: function () { return User_1.User; } });
const Product_1 = require("./Product");
Object.defineProperty(exports, "Product", { enumerable: true, get: function () { return Product_1.Product; } });
const Cart_1 = require("./Cart");
Object.defineProperty(exports, "Cart", { enumerable: true, get: function () { return Cart_1.Cart; } });
const CartItem_1 = require("./CartItem");
Object.defineProperty(exports, "CartItem", { enumerable: true, get: function () { return CartItem_1.CartItem; } });
const Category_1 = require("./Category");
Object.defineProperty(exports, "Category", { enumerable: true, get: function () { return Category_1.Category; } });
const Order_1 = require("./Order");
Object.defineProperty(exports, "Order", { enumerable: true, get: function () { return Order_1.Order; } });
const OrderItem_1 = require("./OrderItem");
Object.defineProperty(exports, "OrderItem", { enumerable: true, get: function () { return OrderItem_1.OrderItem; } });
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../../config/config.json')[env];
let sequelize;
if (config.use_env_variable) {
    exports.sequelize = sequelize = new sequelize_1.Sequelize(process.env[config.use_env_variable], config);
}
else {
    exports.sequelize = sequelize = new sequelize_1.Sequelize(config.database, config.username, config.password, config);
}
// Initialize models
User_1.User.initModel(sequelize);
Product_1.Product.initModel(sequelize);
Cart_1.Cart.initModel(sequelize);
CartItem_1.CartItem.initModel(sequelize);
Category_1.Category.initModel(sequelize);
Order_1.Order.initModel(sequelize);
OrderItem_1.OrderItem.initModel(sequelize);
// Define associations
const models = {
    User: User_1.User,
    Product: Product_1.Product,
    Cart: Cart_1.Cart,
    CartItem: CartItem_1.CartItem,
    Category: Category_1.Category,
    Order: Order_1.Order,
    OrderItem: OrderItem_1.OrderItem,
    sequelize,
    Sequelize: sequelize_1.Sequelize,
};
Object.values(models).forEach((model) => {
    if (model.associate) {
        model.associate(models);
    }
});
exports.default = models;
