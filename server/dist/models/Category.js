"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Category = void 0;
const sequelize_1 = require("sequelize");
class Category extends sequelize_1.Model {
    static associate(models) {
        Category.hasMany(models.Product, { foreignKey: 'categoryId' });
    }
    static initModel(sequelize) {
        Category.init({
            id: {
                type: sequelize_1.DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: sequelize_1.DataTypes.STRING,
                allowNull: false,
            },
            description: {
                type: sequelize_1.DataTypes.TEXT,
                allowNull: true,
            },
        }, {
            sequelize,
            modelName: 'Category',
        });
        return Category;
    }
}
exports.Category = Category;
