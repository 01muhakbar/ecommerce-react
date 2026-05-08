import { DataTypes, Model, Optional, Sequelize } from "sequelize";

interface LanguageAttributes {
  id: number;
  name: string;
  isoCode: string;
  flag: string | null;
  published: boolean;
}

interface LanguageCreationAttributes
  extends Optional<LanguageAttributes, "id" | "flag" | "published"> {}

export class Language
  extends Model<LanguageAttributes, LanguageCreationAttributes>
  implements LanguageAttributes
{
  declare id: number;
  declare name: string;
  declare isoCode: string;
  declare flag: string | null;
  declare published: boolean;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static initModel(sequelize: Sequelize): typeof Language {
    Language.init(
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
        isoCode: {
          type: DataTypes.STRING(16),
          allowNull: false,
          unique: true,
        },
        flag: {
          type: DataTypes.STRING(8),
          allowNull: true,
        },
        published: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true,
        },
      },
      {
        sequelize,
        modelName: "Language",
        tableName: "languages",
      }
    );
    return Language;
  }
}
