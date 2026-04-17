import { DataTypes, Model, Optional, Sequelize } from "sequelize";

export interface SuborderItemAttributes {
  id: number;
  suborderId: number;
  productId: number;
  storeId: number;
  productNameSnapshot: string;
  skuSnapshot?: string | null;
  variantKey?: string | null;
  variantLabel?: string | null;
  variantSelections?: any;
  barcodeSnapshot?: string | null;
  imageSnapshot?: string | null;
  priceSnapshot: number;
  qty: number;
  totalPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

type SuborderItemCreationAttributes = Optional<
  SuborderItemAttributes,
  "id" | "skuSnapshot" | "variantKey" | "variantLabel" | "variantSelections" | "barcodeSnapshot" | "imageSnapshot"
>;

export class SuborderItem
  extends Model<SuborderItemAttributes, SuborderItemCreationAttributes>
  implements SuborderItemAttributes
{
  declare id: number;
  declare suborderId: number;
  declare productId: number;
  declare storeId: number;
  declare productNameSnapshot: string;
  declare skuSnapshot?: string | null;
  declare variantKey?: string | null;
  declare variantLabel?: string | null;
  declare variantSelections?: any;
  declare barcodeSnapshot?: string | null;
  declare imageSnapshot?: string | null;
  declare priceSnapshot: number;
  declare qty: number;
  declare totalPrice: number;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    SuborderItem.belongsTo(models.Suborder, {
      foreignKey: { name: "suborderId", field: "suborder_id" },
      as: "suborder",
    });
    SuborderItem.belongsTo(models.Product, {
      foreignKey: { name: "productId", field: "product_id" },
      as: "product",
    });
    SuborderItem.belongsTo(models.Store, {
      foreignKey: { name: "storeId", field: "store_id" },
      as: "store",
    });
  }

  static initModel(sequelize: Sequelize) {
    return SuborderItem.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        suborderId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "suborder_id",
          references: {
            model: "suborders",
            key: "id",
          },
        },
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "product_id",
          references: {
            model: "products",
            key: "id",
          },
        },
        storeId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "store_id",
          references: {
            model: "stores",
            key: "id",
          },
        },
        productNameSnapshot: {
          type: DataTypes.STRING(255),
          allowNull: false,
          field: "product_name_snapshot",
        },
        skuSnapshot: {
          type: DataTypes.STRING(100),
          allowNull: true,
          field: "sku_snapshot",
        },
        variantKey: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "variant_key",
        },
        variantLabel: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "variant_label",
        },
        variantSelections: {
          type: DataTypes.JSON,
          allowNull: true,
          field: "variant_selections",
        },
        barcodeSnapshot: {
          type: DataTypes.STRING(100),
          allowNull: true,
          field: "barcode_snapshot",
        },
        imageSnapshot: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "image_snapshot",
        },
        priceSnapshot: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          field: "price_snapshot",
        },
        qty: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        totalPrice: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: false,
          field: "total_price",
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
        modelName: "SuborderItem",
        tableName: "suborder_items",
        underscored: true,
      }
    );
  }
}
