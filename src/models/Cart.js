// src/models/Cart.js

module.exports = (sequelize, DataTypes) => {
  // 1. Definisikan model Cart
  const Cart = sequelize.define("Cart", {
    // Kolom userId akan menjadi foreign key
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true, // Setiap user hanya boleh punya satu keranjang
    },
  });

  // 2. Definisikan asosiasi
  Cart.associate = function (models) {
    // Sebuah Cart dimiliki oleh satu User
    Cart.belongsTo(models.User, { foreignKey: "userId" });

    // Sebuah Cart bisa memiliki banyak Product, melalui tabel CartItem
    Cart.belongsToMany(models.Product, {
      through: models.CartItem, // Menggunakan model CartItem sebagai perantara
      foreignKey: "cartId",
      otherKey: "productId",
    });
  };

  // 3. Kembalikan model
  return Cart;
};
