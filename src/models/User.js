// Lokasi File: src/models/User.js
const bcrypt = require("bcrypt");

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define("User", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "pembeli",
      validate: {
        isIn: [["pembeli", "penjual", "admin"]],
      },
    },
    storeName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    refreshToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    passwordResetExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  User.associate = function (models) {
    // Seorang User memiliki satu Cart
    User.hasOne(models.Cart, {
      foreignKey: "userId",
      as: "cart",
      onDelete: 'CASCADE' // Tambahkan baris ini
    });
  };

  // Hook untuk melakukan hashing password sebelum user dibuat
  User.beforeCreate(async (user, options) => {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    user.password = hashedPassword;
  });

  // Hook untuk melakukan hashing password sebelum user di-update
  User.beforeUpdate(async (user, options) => {
    // Hanya hash password jika field 'password' diubah
    if (user.changed('password')) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      user.password = hashedPassword;
    }
  });

  return User;
};
