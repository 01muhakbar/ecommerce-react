import { DataTypes, Model, Sequelize, Optional } from "sequelize";

interface CartItemAttributes {
  id: number;
  cartId: number;
  productId: number;
  quantity: number;
  variantKey?: string | null;
  variantLabel?: string | null;
  variantSelections?: any;
  variantSkuSnapshot?: string | null;
  variantBarcodeSnapshot?: string | null;
  unitPriceSnapshot?: number | null;
  unitSalePriceSnapshot?: number | null;
  variantImageSnapshot?: string | null;
}

interface CartItemCreationAttributes
  extends Optional<CartItemAttributes, "id"> {}

export class CartItem
  extends Model<CartItemAttributes, CartItemCreationAttributes>
  implements CartItemAttributes
{
  declare id: number;
  declare cartId: number;
  declare productId: number;
  declare quantity: number;
  declare variantKey?: string | null;
  declare variantLabel?: string | null;
  declare variantSelections?: any;
  declare variantSkuSnapshot?: string | null;
  declare variantBarcodeSnapshot?: string | null;
  declare unitPriceSnapshot?: number | null;
  declare unitSalePriceSnapshot?: number | null;
  declare variantImageSnapshot?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    // Definisikan relasi balik ke Cart dan Product
    CartItem.belongsTo(models.Cart, { foreignKey: "cartId" });
    CartItem.belongsTo(models.Product, { foreignKey: "productId" });
  }

  static initModel(sequelize: Sequelize): typeof CartItem {
    CartItem.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        cartId: {
          type: DataTypes.INTEGER.UNSIGNED,
          field: "cart_id",
          allowNull: false,
        },
        productId: {
          type: DataTypes.INTEGER.UNSIGNED,
          allowNull: false,
          field: "product_id",
        },
        quantity: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 1,
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
        variantSkuSnapshot: {
          type: DataTypes.STRING(100),
          allowNull: true,
          field: "variant_sku_snapshot",
        },
        variantBarcodeSnapshot: {
          type: DataTypes.STRING(100),
          allowNull: true,
          field: "variant_barcode_snapshot",
        },
        unitPriceSnapshot: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          field: "unit_price_snapshot",
        },
        unitSalePriceSnapshot: {
          type: DataTypes.DECIMAL(12, 2),
          allowNull: true,
          field: "unit_sale_price_snapshot",
        },
        variantImageSnapshot: {
          type: DataTypes.STRING(255),
          allowNull: true,
          field: "variant_image_snapshot",
        },
      },
      {
        sequelize,
        modelName: "CartItem",
        underscored: true,
      }
    );
    return CartItem;
  }
}
