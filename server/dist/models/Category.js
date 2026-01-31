import { DataTypes, Model } from "sequelize";
export class Category extends Model {
    static associate(_models) {
        Category.hasMany(Category, { as: "children", foreignKey: "parentId" });
        Category.belongsTo(Category, { as: "parent", foreignKey: "parentId" });
    }
    static initModel(sequelize) {
        Category.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            code: {
                type: DataTypes.STRING(32),
                allowNull: false,
                unique: true,
            },
            name: {
                type: DataTypes.STRING(120),
                allowNull: false,
            },
            description: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            icon: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },
            published: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            parentId: {
                field: "parent_id",
                type: DataTypes.INTEGER.UNSIGNED,
                allowNull: true,
            },
        }, {
            sequelize,
            modelName: "Category",
            tableName: "Categories",
            underscored: true,
        });
        return Category;
    }
}
