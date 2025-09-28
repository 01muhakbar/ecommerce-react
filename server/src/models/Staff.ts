import { DataTypes, Model, Optional, Sequelize } from "sequelize";

// Attributes interface
type StaffAttrs = {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  contactNumber?: string | null;
  joiningDate?: string | null; // DATEONLY
  role: "Super Admin" | "Admin" | "Manager" | "Staff" | string;
  routes: string[];
  avatarUrl?: string | null;
  status: "Active" | "Inactive";
  published: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

// Creation attributes interface (some fields are optional during creation)
type CreationAttrs = Optional<StaffAttrs, "id" | "avatarUrl" | "contactNumber" | "joiningDate" | "routes" | "role" | "status" | "published" | "createdAt" | "updatedAt">;

export class Staff extends Model<StaffAttrs, CreationAttrs> implements StaffAttrs {
  declare id: number;
  declare name: string;
  declare email: string;
  declare passwordHash: string;
  declare contactNumber?: string | null;
  declare joiningDate?: string | null;
  declare role: "Super Admin" | "Admin" | "Manager" | "Staff" | string;
  declare routes: string[];
  declare avatarUrl?: string | null;
  declare status: "Active" | "Inactive";
  declare published: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  // Placeholder for associations
  public static associate(models: any) {
    // e.g., Staff.hasMany(models.SomeOtherModel);
  }

  // Initialization logic
  public static initModel(sequelize: Sequelize) {
    Staff.init(
      {
        id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
        name: { type: DataTypes.STRING(120), allowNull: false },
        email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
        passwordHash: { type: DataTypes.STRING(180), allowNull: false },
        contactNumber: { type: DataTypes.STRING(40) },
        joiningDate: { type: DataTypes.DATEONLY },
        role: { type: DataTypes.STRING(40), allowNull: false, defaultValue: "Staff" },
        routes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
        avatarUrl: { type: DataTypes.STRING(255) },
        status: { type: DataTypes.STRING, defaultValue: 'Inactive', allowNull: false },
        published: { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      },
      {
        tableName: "Staffs",
        sequelize,
        timestamps: true,
        underscored: false, // Use createdAt/updatedAt (camelCase)
      }
    );
    return Staff;
  }
}