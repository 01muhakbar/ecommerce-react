import { DataTypes, Model } from "sequelize";
export class User extends Model {
    static associate(models) {
        User.hasMany(models.Product, { foreignKey: "userId", as: "products" });
        User.hasOne(models.Cart, { foreignKey: "userId", as: "cart" });
        User.hasMany(models.Order, { foreignKey: "userId", as: "orders" });
    }
    static initModel(sequelize) {
        User.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                primaryKey: true,
                autoIncrement: true,
            },
            name: { type: DataTypes.STRING, allowNull: false },
            email: { type: DataTypes.STRING, allowNull: false, unique: true },
            phoneNumber: { type: DataTypes.STRING, field: "phone_number" },
            password: { type: DataTypes.STRING, allowNull: false },
            role: {
                type: DataTypes.ENUM("Super Admin", "Admin", "Cashier", "CEO", "Manager", "Accountant", "Driver", "Security Guard", "Delivery Person", "user", "seller"),
                allowNull: false,
                defaultValue: "user",
            },
            isActive: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: "is_active",
            },
            published: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
                field: "published",
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: "created_at",
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: false,
                field: "updated_at",
            },
            joinedAt: { type: DataTypes.DATE, field: "joined_at" },
            avatarUrl: { type: DataTypes.STRING, field: "avatar_url" },
            allowedRoutes: { type: DataTypes.JSON, field: "allowed_routes" },
            resetToken: {
                type: DataTypes.STRING,
                allowNull: true,
                field: "reset_token",
            },
            passwordResetToken: {
                type: DataTypes.STRING,
                allowNull: true,
                field: "password_reset_token",
            },
            resetTokenExpires: {
                type: DataTypes.DATE,
                allowNull: true,
                field: "reset_token_expires",
            },
            passwordResetExpires: {
                type: DataTypes.DATE,
                allowNull: true,
                field: "password_reset_expires",
            },
        }, {
            sequelize,
            tableName: "Users",
            underscored: true,
        });
        return User;
    }
}
