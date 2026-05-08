import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export type UserAddressMarkAs = "HOME" | "OFFICE";

export interface UserAddressAttributes {
  id: number;
  userId: number;
  fullName: string;
  phoneNumber: string;
  province: string;
  city: string;
  district: string;
  postalCode: string;
  streetName: string;
  building?: string | null;
  houseNumber: string;
  otherDetails?: string | null;
  markAs: UserAddressMarkAs;
  isPrimary: boolean;
  isStore: boolean;
  isReturn: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type UserAddressCreationAttributes = Optional<
  UserAddressAttributes,
  | "id"
  | "building"
  | "otherDetails"
  | "markAs"
  | "isPrimary"
  | "isStore"
  | "isReturn"
>;

export class UserAddress
  extends Model<UserAddressAttributes, UserAddressCreationAttributes>
  implements UserAddressAttributes
{
  declare id: number;
  declare userId: number;
  declare fullName: string;
  declare phoneNumber: string;
  declare province: string;
  declare city: string;
  declare district: string;
  declare postalCode: string;
  declare streetName: string;
  declare building?: string | null;
  declare houseNumber: string;
  declare otherDetails?: string | null;
  declare markAs: UserAddressMarkAs;
  declare isPrimary: boolean;
  declare isStore: boolean;
  declare isReturn: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    UserAddress.belongsTo(models.User, {
      foreignKey: "userId",
      as: "user",
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    if (models.User && typeof models.User.hasMany === "function") {
      models.User.hasMany(models.UserAddress, {
        foreignKey: "userId",
        as: "addresses",
      });
    }
  }

  static initModel(sequelize: Sequelize): typeof UserAddress {
    UserAddress.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        userId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        fullName: {
          type: DataTypes.STRING(120),
          allowNull: false,
          field: "full_name",
        },
        phoneNumber: {
          type: DataTypes.STRING(30),
          allowNull: false,
          field: "phone_number",
        },
        province: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        city: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        district: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        postalCode: {
          type: DataTypes.STRING(10),
          allowNull: false,
          field: "postal_code",
        },
        streetName: {
          type: DataTypes.STRING(200),
          allowNull: false,
          field: "street_name",
        },
        building: {
          type: DataTypes.STRING(120),
          allowNull: true,
        },
        houseNumber: {
          type: DataTypes.STRING(50),
          allowNull: false,
          field: "house_number",
        },
        otherDetails: {
          type: DataTypes.TEXT,
          allowNull: true,
          field: "other_details",
        },
        markAs: {
          type: DataTypes.ENUM("HOME", "OFFICE"),
          allowNull: false,
          defaultValue: "HOME",
          field: "mark_as",
        },
        isPrimary: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "is_primary",
        },
        isStore: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "is_store",
        },
        isReturn: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
          field: "is_return",
        },
      },
      {
        sequelize,
        modelName: "UserAddress",
        tableName: "user_addresses",
        underscored: true,
      }
    );

    return UserAddress;
  }
}
