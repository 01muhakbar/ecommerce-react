import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface StoreAttributes {
  id: number;
  ownerUserId: number;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE";
  description?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  websiteUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  country?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

type StoreCreationAttributes = Optional<
  StoreAttributes,
  | "id"
  | "status"
  | "description"
  | "logoUrl"
  | "bannerUrl"
  | "email"
  | "phone"
  | "whatsapp"
  | "websiteUrl"
  | "instagramUrl"
  | "tiktokUrl"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "province"
  | "postalCode"
  | "country"
>;

export class Store
  extends Model<StoreAttributes, StoreCreationAttributes>
  implements StoreAttributes
{
  declare id: number;
  declare ownerUserId: number;
  declare name: string;
  declare slug: string;
  declare status: "ACTIVE" | "INACTIVE";
  declare description: string | null;
  declare logoUrl: string | null;
  declare bannerUrl: string | null;
  declare email: string | null;
  declare phone: string | null;
  declare whatsapp: string | null;
  declare websiteUrl: string | null;
  declare instagramUrl: string | null;
  declare tiktokUrl: string | null;
  declare addressLine1: string | null;
  declare addressLine2: string | null;
  declare city: string | null;
  declare province: string | null;
  declare postalCode: string | null;
  declare country: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    models.User.hasOne(Store, {
      foreignKey: { name: "ownerUserId", field: "owner_user_id" },
      as: "store",
    });
    Store.belongsTo(models.User, {
      foreignKey: { name: "ownerUserId", field: "owner_user_id" },
      as: "owner",
    });
    Store.hasOne(models.StorePaymentProfile, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "paymentProfile",
    });
    Store.hasMany(models.Suborder, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "suborders",
    });
    Store.hasMany(models.Payment, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "payments",
    });
    Store.hasMany(models.Product, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "products",
    });
  }

  static initModel(sequelize: Sequelize) {
    return Store.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        ownerUserId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          unique: true,
          field: "owner_user_id",
          references: {
            model: "users",
            key: "id",
          },
        },
        name: {
          type: DataTypes.STRING(160),
          allowNull: false,
        },
        slug: {
          type: DataTypes.STRING(180),
          allowNull: false,
          unique: true,
        },
        status: {
          type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
          allowNull: false,
          defaultValue: "ACTIVE",
        },
        description: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        logoUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: "logo_url",
        },
        bannerUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: "banner_url",
        },
        email: {
          type: DataTypes.STRING(160),
          allowNull: true,
        },
        phone: {
          type: DataTypes.STRING(64),
          allowNull: true,
        },
        whatsapp: {
          type: DataTypes.STRING(64),
          allowNull: true,
        },
        websiteUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: "website_url",
        },
        instagramUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: "instagram_url",
        },
        tiktokUrl: {
          type: DataTypes.STRING(2048),
          allowNull: true,
          field: "tiktok_url",
        },
        addressLine1: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "address_line_1",
        },
        addressLine2: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "address_line_2",
        },
        city: {
          type: DataTypes.STRING(120),
          allowNull: true,
        },
        province: {
          type: DataTypes.STRING(120),
          allowNull: true,
        },
        postalCode: {
          type: DataTypes.STRING(32),
          allowNull: true,
          field: "postal_code",
        },
        country: {
          type: DataTypes.STRING(120),
          allowNull: true,
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
      },
      {
        sequelize,
        modelName: "Store",
        tableName: "stores",
        underscored: true,
      }
    );
  }
}
