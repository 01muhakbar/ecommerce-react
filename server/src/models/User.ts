import {
  Model,
  DataTypes,
  Sequelize,
  Optional,
  HasManyGetAssociationsMixin,
  HasManyAddAssociationMixin,
  HasOneGetAssociationMixin,
} from "sequelize";
import bcrypt from "bcryptjs";
import { Product } from "./Product.js";
import { Cart } from "./Cart.js";
import { Order } from "./Order.js";

// Interface untuk atribut User
export interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password?: string; // Password bisa opsional saat pengambilan data
  role: "user" | "admin" | "seller";
  storeName?: string;
  phoneNumber?: string;
  gender?: "male" | "female" | "other";
  dateOfBirth?: Date;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

// Interface untuk atribut pembuatan User (password wajib)
interface UserCreationAttributes
  extends Optional<UserAttributes, "id" | "isActive"> {
  password: string;
}

export class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes
{
  // --- ATTRIBUTES ---
  // Gunakan 'public declare' untuk menghindari shadowing getter/setter Sequelize.
  public declare id: number;
  public declare name: string;
  public declare email: string;
  public declare password?: string;
  public declare role: "user" | "admin" | "seller";
  public declare storeName?: string;
  public declare phoneNumber?: string;
  public declare gender?: "male" | "female" | "other";
  public declare dateOfBirth?: Date;
  public declare refreshToken?: string;
  public declare passwordResetToken?: string;
  public declare passwordResetExpires?: Date;
  public declare isActive: boolean;

  public declare readonly createdAt: Date;
  public declare readonly updatedAt: Date;

  // --- ASSOCIATIONS ---
  public declare getProducts: HasManyGetAssociationsMixin<Product>;
  public declare addProduct: HasManyAddAssociationMixin<Product, number>;
  public declare getCart: HasOneGetAssociationMixin<Cart>;
  public declare getOrders: HasManyGetAssociationsMixin<Order>;

  // --- CLASS METHODS ---
  public static associate(models: any) {
    User.hasMany(models.Product, {
      foreignKey: "userId",
      as: "products",
    });
    User.hasOne(models.Cart, {
      foreignKey: "userId",
      as: "cart",
    });
    User.hasMany(models.Order, {
      foreignKey: "userId",
      as: "orders",
    });
  }

  public static initModel(sequelize: Sequelize) {
    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
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
        },
        role: {
          type: DataTypes.ENUM("user", "admin", "seller"),
          defaultValue: "user",
          allowNull: false,
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
          type: DataTypes.ENUM("male", "female", "other"),
          allowNull: true,
        },
        dateOfBirth: {
          type: DataTypes.DATE,
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
          defaultValue: true,
        },
      },
      {
        sequelize,
        tableName: "Users",
        timestamps: true,
        hooks: {
          beforeSave: async (user: User) => {
            // Hanya hash password jika field ini berubah (atau saat baru dibuat)
            if (user.changed("password") && user.password) {
              user.password = await bcrypt.hash(user.password, 12);
            }
          },
        },
      }
    );
    return User;
  }
}