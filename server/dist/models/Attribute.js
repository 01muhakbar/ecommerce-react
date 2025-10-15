import { DataTypes, Model } from "sequelize";
export class Attribute extends Model {
    static initModel(sequelize) {
        Attribute.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        }, {
            sequelize,
            modelName: "Attribute",
            tableName: "attributes",
            underscored: true,
        });
        return Attribute;
    }
}
