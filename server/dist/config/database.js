// server/src/config/database.ts
import "dotenv/config";
import { Sequelize } from "sequelize";
const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } = process.env;
let sequelize;
if (DATABASE_URL) {
    sequelize = new Sequelize(DATABASE_URL, {
        logging: false,
        dialectOptions: {},
    });
}
else {
    sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASS, {
        host: DB_HOST || "localhost",
        port: DB_PORT ? Number(DB_PORT) : 3306,
        dialect: "mysql",
        logging: false,
    });
}
export default sequelize;
