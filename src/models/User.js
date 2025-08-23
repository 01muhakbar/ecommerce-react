"use strict";
const { Model } = require("sequelize");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Seorang User memiliki satu Cart
      User.hasOne(models.Cart, {
        foreignKey: "userId",
        as: "cart",
        onDelete: "CASCADE",
      });

      // Seorang User (Penjual) bisa memiliki banyak Product
      User.hasMany(models.Product, {
        foreignKey: "userId",
        as: "products",
      });
    }

    // Instance method untuk membandingkan password
    // Ini akan tersedia pada setiap instance dari model User
    async correctPassword(candidatePassword) {
      return await bcrypt.compare(candidatePassword, this.password);
    }

    // Instance method untuk membuat token reset password
    createPasswordResetToken() {
      // 1. Buat token acak
      const resetToken = crypto.randomBytes(32).toString("hex");

      // 2. Hash token tersebut dan simpan di database
      this.passwordResetToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

      // 3. Atur waktu kedaluwarsa (misal: 10 menit)
      this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

      // 4. Kembalikan token yang belum di-hash untuk dikirim via email
      return resetToken;
    }
  }

  User.init(
    {
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
        validate: {
          len: [8, 255], // Password minimal 8 karakter
        },
      },
      role: {
        type: DataTypes.ENUM("pembeli", "penjual", "admin"),
        allowNull: false,
        defaultValue: "pembeli",
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
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      modelName: "User",
      hooks: {
        // Hook ini berjalan sebelum record disimpan (baik create maupun update)
        beforeSave: async (user, options) => {
          // Hanya hash password jika field password diubah
          if (user.changed("password")) {
            user.password = await bcrypt.hash(user.password, 12);
          }
        },
      },
    }
  );

  return User;
};
