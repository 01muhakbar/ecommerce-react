import { DataTypes, Model } from "sequelize";
export class Category extends Model {
    static associate(models) {
        Category.hasMany(models.Product, { foreignKey: "categoryId" });
    }
    static initModel(sequelize) {
        Category.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
        }, {
            sequelize,
            modelName: "Category",
        });
        return Category;
    }
}
