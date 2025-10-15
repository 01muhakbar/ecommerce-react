// server/src/config/database.ts
import "dotenv/config";
import { Sequelize } from "sequelize";

const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } =
  process.env;

let sequelize: Sequelize;

if (DATABASE_URL) {
  sequelize = new Sequelize(DATABASE_URL, {
    logging: false,
    dialectOptions: {},
  });
} else {
  sequelize = new Sequelize(
    DB_NAME as string,
    DB_USER as string,
    DB_PASS as string,
    {
      host: DB_HOST || "localhost",
      port: DB_PORT ? Number(DB_PORT) : 3306,
      dialect: "mysql",
      logging: false,
    }
  );
}

export default sequelize;
