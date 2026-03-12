// server/src/models/User.ts
import {
  Sequelize,
  DataTypes,
  Model,
  InferAttributes,
  InferCreationAttributes,
  CreationOptional,
} from "sequelize";

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare name: string;
  declare email: string;
  declare password: string; // hashed
  declare phoneNumber: CreationOptional<string | null>;
  declare avatarUrl: CreationOptional<string | null>;
  declare role: string;     // "super_admin" | "admin" | "staff" | "user" | ...
  declare sellerRoleCode: CreationOptional<string | null>;
  declare permissionKeys: CreationOptional<string | null>;
  declare status: string;   // "active" | "inactive" | ...
  declare isPublished: CreationOptional<boolean>;

  declare created_at: CreationOptional<Date>;
  declare updated_at: CreationOptional<Date>;
}

export function initUser(sequelize: Sequelize) {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: "",
      },
      email: {
        type: DataTypes.STRING(160),
        allowNull: false,
        validate: { isEmail: true },
      },
      phoneNumber: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "phone_number",
      },
      avatarUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "avatar_url",
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
        // simpan hash bcrypt
      },
      role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "user",
        // kamu bisa batasi pakai ENUM kalau semua role sudah fix.
        // DataTypes.ENUM("super_admin", "admin", "staff", "user")
      },
      sellerRoleCode: {
        type: DataTypes.STRING(64),
        allowNull: true,
        field: "seller_role_code",
      },
      permissionKeys: {
        type: DataTypes.TEXT("long"),
        allowNull: true,
        field: "permission_keys",
      },
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "active",
      },
      isPublished: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_published",
      },

      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: "User",
      tableName: "users",
      underscored: true, // pakai created_at / updated_at (cocok dengan log kamu sebelumnya)
      indexes: [{ unique: true, fields: ["email"] }],
    }
  );
}
