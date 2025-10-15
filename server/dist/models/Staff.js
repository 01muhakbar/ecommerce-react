import { DataTypes, Model } from "sequelize";
export class Staff extends Model {
    // Placeholder for associations
    static associate(models) {
        // e.g., Staff.hasMany(models.SomeOtherModel);
    }
    // Initialization logic
    static initModel(sequelize) {
        Staff.init({
            id: {
                type: DataTypes.INTEGER.UNSIGNED,
                autoIncrement: true,
                primaryKey: true,
            },
            name: { type: DataTypes.STRING, allowNull: false },
            email: { type: DataTypes.STRING, unique: true, allowNull: false },
            passwordHash: { type: DataTypes.STRING, allowNull: false },
            role: {
                type: DataTypes.ENUM("admin", "super_admin", "editor", "viewer"),
                allowNull: false,
                defaultValue: "editor",
            },
            status: {
                type: DataTypes.ENUM("Active", "Inactive"),
                allowNull: false,
                defaultValue: "Active",
            },
            routes: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: [],
            },
        }, {
            tableName: "staff",
            sequelize,
            timestamps: true,
            underscored: true,
        });
        return Staff;
    }
}
