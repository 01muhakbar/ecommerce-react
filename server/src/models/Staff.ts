import { DataTypes, Model, Optional, Sequelize } from "sequelize";

// Attributes interface
export interface StaffAttributes {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  role: "admin" | "super_admin" | "editor" | "viewer";
  status: "Active" | "Inactive";
  routes?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Creation attributes interface (some fields are optional during creation)
interface StaffCreationAttributes
  extends Optional<StaffAttributes, "id" | "status" | "routes"> {}

export class Staff
  extends Model<StaffAttributes, StaffCreationAttributes>
  implements StaffAttributes
{
  declare id: number;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare role: "admin" | "super_admin" | "editor" | "viewer";
  declare status: "Active" | "Inactive";
  declare routes?: string[];
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Placeholder for associations
  public static associate(models: any): void {
    // e.g., Staff.hasMany(models.SomeOtherModel);
  }

  // Initialization logic
  public static initModel(sequelize: Sequelize) {
    Staff.init(
      {
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
      },
      {
        tableName: "staff",
        sequelize,
        timestamps: true,
        underscored: true,
      }
    );
    return Staff;
  }
}
