import { DataTypes, Model, Optional, Sequelize } from "sequelize";

interface CurrencyAttributes {
  id: number;
  name: string;
  code: string;
  symbol: string;
  exchangeRate: string;
  published: boolean;
}

interface CurrencyCreationAttributes
  extends Optional<CurrencyAttributes, "id" | "exchangeRate" | "published"> {}

export class Currency
  extends Model<CurrencyAttributes, CurrencyCreationAttributes>
  implements CurrencyAttributes
{
  declare id: number;
  declare name: string;
  declare code: string;
  declare symbol: string;
  declare exchangeRate: string;
  declare published: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Currency {
    Currency.init(
      {
        id: {
          type: DataTypes.INTEGER.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
        },
        name: {
          type: DataTypes.STRING(120),
          allowNull: false,
        },
        code: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
        },
        symbol: {
          type: DataTypes.STRING(16),
          allowNull: false,
        },
        exchangeRate: {
          type: DataTypes.DECIMAL(18, 6),
          allowNull: false,
          defaultValue: "1",
          field: "exchange_rate",
        },
        published: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: "Currency",
        tableName: "currencies",
      }
    );
    return Currency;
  }
}
