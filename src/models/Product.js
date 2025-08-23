// Lokasi File: src/models/Product.js

module.exports = (sequelize, DataTypes) => {
  // 1. Definisikan model 'Product' beserta atributnya
  const Product = sequelize.define("Product", {
    name: {
      type: DataTypes.STRING,
      allowNull: false, // Nama produk tidak boleh kosong
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true, // Deskripsi boleh kosong
    },
    price: {
      type: DataTypes.DECIMAL(10, 2), // Tipe data yang cocok untuk harga
      allowNull: false,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0, // Jika tidak diisi, stok akan bernilai 0
    },
  });

  // 2. Definisikan hubungan/asosiasi dengan model lain
  Product.associate = function (models) {
    // Sebuah Product bisa ada di banyak Cart, melalui tabel CartItem
    Product.belongsToMany(models.Cart, {
      through: models.CartItem, // Gunakan model CartItem secara langsung
      foreignKey: "productId",
      otherKey: "cartId",
    });

    // Sebuah Product dimiliki oleh satu User (Penjual)
    Product.belongsTo(models.User, {
      foreignKey: "userId",
      as: "seller",
      onDelete: "CASCADE",
    });
  };

  // 3. Kembalikan model agar bisa digunakan oleh index.js
  return Product;
};
