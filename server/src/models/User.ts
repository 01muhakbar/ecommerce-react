import { DataTypes, Model, Optional, Sequelize } from 'sequelize';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: 'pembeli' | 'penjual' | 'admin';
  storeName?: string;
  phoneNumber?: string;
  gender?: 'Laki-laki' | 'Perempuan' | 'Lainnya';
  dateOfBirth?: Date;
  refreshToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  isActive: boolean;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'isActive' | 'role'> {}

export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public name!: string;
  public email!: string;
  public password!: string;
  public role!: 'pembeli' | 'penjual' | 'admin';
  public storeName?: string;
  public phoneNumber?: string;
  public gender?: 'Laki-laki' | 'Perempuan' | 'Lainnya';
  public dateOfBirth?: Date;
  public refreshToken?: string;
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;
  public isActive!: boolean;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
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

  async correctPassword(candidatePassword: string): Promise<boolean> {
    return await bcrypt.compare(candidatePassword, this.password);
  }

  createPasswordResetToken(): string {
    const resetToken = crypto.randomBytes(32).toString("hex");

    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

    return resetToken;
  }

  static initModel(sequelize: Sequelize): typeof User {
    User.init(
      {
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
          type: DataTypes.ENUM('Laki-laki', 'Perempuan', 'Lainnya'),
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
      },
      {
        sequelize,
        modelName: "User",
        hooks: {
          beforeSave: async (user: User) => {
            if (user.changed("password")) {
              user.password = await bcrypt.hash(user.password, 12);
            }
          },
        },
      }
    );
    return User;
  }
}
