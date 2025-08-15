// src/models/CartItem.js

module.exports = (sequelize, DataTypes) => {
  const CartItem = sequelize.define("CartItem", {
    // Ini adalah model perantara (join table) antara Cart dan Product.
    // Kolom `id`, `cartId`, dan `productId` akan dibuat secara otomatis
    // oleh Sequelize berdasarkan asosiasi `belongsToMany`.
    // Kita hanya perlu mendefinisikan kolom tambahan.

    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
  });

  // Asosiasi untuk model perantara tidak wajib didefinisikan di sini
  // karena sudah diatur oleh `belongsToMany` di model Cart dan Product.
  // Namun, jika Anda ingin bisa melakukan query seperti `CartItem.getProduct()`,
  // Anda bisa menambahkannya.

  return CartItem;
};
