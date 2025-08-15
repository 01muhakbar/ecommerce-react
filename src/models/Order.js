// src/models/Order.js

module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define("Order", {
    // Foreign key untuk menghubungkan ke User
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pending", // Contoh status: pending, completed, cancelled
      validate: {
        isIn: [["pending", "completed", "cancelled"]],
      },
    },
    // Anda bisa menambahkan kolom lain seperti alamat pengiriman, dll.
  });

  Order.associate = function (models) {
    // Sebuah Order dimiliki oleh satu User
    Order.belongsTo(models.User, { foreignKey: "userId" });

    // Untuk melacak produk apa saja yang ada di dalam order,
    // Anda akan butuh model perantara lain, misalnya 'OrderItem'.
    // Order.belongsToMany(models.Product, { through: 'OrderItem', foreignKey: 'orderId' });
  };

  return Order;
};
