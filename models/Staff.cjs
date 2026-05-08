'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class Staff extends Model {
    static associate(models) {
      // define association here
    }
  }
  Staff.init({
    id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull:false },
    email: { type: DataTypes.STRING, allowNull:false, unique:true },
    role: { type: DataTypes.ENUM("admin","super_admin","editor","viewer"), allowNull:false, defaultValue:"editor" },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, {
    sequelize,
    modelName: 'Staff',
    tableName: 'staff'
  });
  return Staff;
};
