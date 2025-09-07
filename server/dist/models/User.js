import { DataTypes, Model } from "sequelize";
import bcrypt from "bcryptjs";
import crypto from "crypto";
export class User extends Model {
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
        return await bcrypt.compare(candidatePassword, this.password);
    }
    createPasswordResetToken() {
        const resetToken = crypto.randomBytes(32).toString("hex");
        this.passwordResetToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");
        this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
        return resetToken;
    }
    static initModel(sequelize) {
        User.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
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
                    len: [8, 255],
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
            phoneNumber: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            gender: {
                type: DataTypes.ENUM("Laki-laki", "Perempuan", "Lainnya"),
                allowNull: true,
            },
            dateOfBirth: {
                type: DataTypes.DATEONLY,
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
        }, {
            sequelize,
            modelName: "User",
            hooks: {
                beforeSave: async (user) => {
                    if (user.changed("password")) {
                        user.password = await bcrypt.hash(user.password, 12);
                    }
                },
            },
        });
        return User;
    }
}
