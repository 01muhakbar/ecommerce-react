import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { Product } from "./Product";
import { Cart } from "./Cart";
import { Order } from "./Order";

export type StaffRole = "Super Admin" | "Admin" | "User";

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  phoneNumber?: string | null;
  password?: string;
  role: StaffRole;
  isActive: boolean;
  published: boolean;
  resetToken?: string | null;
  passwordResetToken?: string | null;
  resetTokenExpires?: Date | null;
  passwordResetExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  joinedAt?: Date | null;
  avatarUrl?: string | null;
  allowedRoutes?: string[] | null;
}

type UserCreationAttributes = Optional<
  UserAttributes,
  | "id"
  | "phoneNumber"
  | "isActive"
  | "published"
  | "createdAt"
  | "updatedAt"
  | "password"
  | "joinedAt"
  | "avatarUrl"
  | "allowedRoutes"
>;

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  public declare id: number;
  public declare name: string;
  public declare email: string;
  public declare phoneNumber: string | null;
  public declare password: string;
  public declare role: StaffRole;
  public declare isActive: boolean;
  public declare published: boolean;
  public declare resetToken: string | null;
  public declare passwordResetToken: string | null;
  public declare resetTokenExpires: Date | null;
  public declare passwordResetExpires: Date | null;
  public declare readonly createdAt: Date;
  public declare readonly updatedAt: Date;
  public declare joinedAt: Date | null;
  public declare avatarUrl: string | null;
  public declare allowedRoutes: string[] | null;

  public static associate(models: any) {
    User.hasMany(models.Product, { foreignKey: "userId", as: "products" });
    User.hasOne(models.Cart, { foreignKey: "userId", as: "cart" });
    User.hasMany(models.Order, { foreignKey: "userId", as: "orders" });
  }

  public static initModel(sequelize: Sequelize) {
    User.init(
      {
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
          type: DataTypes.ENUM(
            "Super Admin",
            "Admin",
            "Cashier",
            "CEO",
            "Manager",
            "Accountant",
            "Driver",
            "Security Guard",
            "Delivery Person",
            "user",
            "seller"
          ),
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
      },
      {
        sequelize,
        tableName: "Users",
        underscored: true,
      }
    );
    return User;
  }
}
