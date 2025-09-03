"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const sequelize_1 = require("sequelize");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = __importDefault(require("crypto"));
class User extends sequelize_1.Model {
    static associate(models) {
        User.hasOne(models.Cart, {
            foreignKey: "userId",
            as: "cart",
            onDelete: "CASCADE",
        });
        User.hasMany(models.Product, {
            foreignKey: "userId",
            as: "products",
        });
    }
    async correctPassword(candidatePassword) {
        return await bcryptjs_1.default.compare(candidatePassword, this.password);
    }
    createPasswordResetToken() {
        const resetToken = crypto_1.default.randomBytes(32).toString("hex");
        this.passwordResetToken = crypto_1.default
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
        return resetToken;
    }
    static initModel(sequelize) {
        User.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            email: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                unique: true,
                validate: {
                    isEmail: true,
                },
            },
            password: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
                validate: {
                    len: [8, 255],
                },
            },
            role: {
                type: sequelize_1.DataTypes.ENUM("pembeli", "penjual", "admin"),
                allowNull: false,
                defaultValue: "pembeli",
            },
            storeName: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            phoneNumber: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            gender: {
                type: sequelize_1.DataTypes.ENUM('Laki-laki', 'Perempuan', 'Lainnya'),
                allowNull: true,
            },
            dateOfBirth: {
                type: sequelize_1.DataTypes.DATEONLY,
                allowNull: true,
            },
            refreshToken: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            passwordResetToken: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: true,
            },
            passwordResetExpires: {
                type: sequelize_1.DataTypes.DATE,
                allowNull: true,
            },
            isActive: {
                type: sequelize_1.DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
        }, {
            sequelize,
            modelName: "User",
            hooks: {
                beforeSave: async (user) => {
                    if (user.changed("password")) {
                        user.password = await bcryptjs_1.default.hash(user.password, 12);
                    }
                },
            },
        });
        return User;
    }
}
exports.User = User;
