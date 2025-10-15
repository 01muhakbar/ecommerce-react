// models/SequelizeInstance.ts
import { Sequelize } from "sequelize";
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    dialect: "mysql",
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    define: { underscored: true },
    dialectOptions: {
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
    },
});
export default sequelize;
