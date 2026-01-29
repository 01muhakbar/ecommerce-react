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
  declare role: string;     // "super_admin" | "admin" | "staff" | "user" | ...
  declare status: string;   // "active" | "inactive" | ...

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
      status: {
        type: DataTypes.STRING(32),
        allowNull: false,
        defaultValue: "active",
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
