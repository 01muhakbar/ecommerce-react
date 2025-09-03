import { Sequelize, DataTypes, ModelCtor, Model } from 'sequelize';
import { User } from './User';
import { Product } from './Product';
import { Cart } from './Cart';
import { CartItem } from './CartItem';
import { Category } from './Category';
import { Order } from './Order';
import { OrderItem } from './OrderItem';

const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../../config/config.json')[env];

let sequelize: Sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable] as string, config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

// Initialize models
User.initModel(sequelize);
Product.initModel(sequelize);
Cart.initModel(sequelize);
CartItem.initModel(sequelize);
Category.initModel(sequelize);
Order.initModel(sequelize);
OrderItem.initModel(sequelize);

// Define associations
const models = {
  User,
  Product,
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
  sequelize,
  Sequelize,
};

Object.values(models).forEach((model: any) => {
  if (model.associate) {
    model.associate(models);
  }
});

export {
  sequelize,
  Sequelize,
  User,
  Product,
  Cart,
  CartItem,
  Category,
  Order,
  OrderItem,
};

export default models;