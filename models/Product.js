'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Product extends Model {
    static associate(models) {
      // Produk memiliki banyak item pesanan
      this.hasMany(models.OrderItem, {
        foreignKey: 'productId',
        as: 'orderItems',
      });
    }
  }

  Product.init({
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER.UNSIGNED
    },
    // Di model, kita gunakan camelCase, Sequelize akan otomatis map ke snake_case di DB
    productName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    // Optional media fields (added via migrations)
    promoImagePath: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    imagePaths: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName: 'Product',
    timestamps: true,
    underscored: true, // Ini akan meng-map camelCase di model ke snake_case di tabel DB
  });

  return Product;
};
