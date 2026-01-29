// server/src/config/database.ts
import "dotenv/config";
import { Sequelize } from "sequelize";

const { DATABASE_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS } =
  process.env;

let sequelize: Sequelize;

// Single source of truth for Sequelize instance across the server.
const sequelizeArgs: [string, any] | [string, string, string, any] = DATABASE_URL
  ? [
      DATABASE_URL,
      {
        logging: false,
        dialectOptions: {},
      },
    ]
  : [
      (DB_NAME || "ecommerce_dev") as string,
      (DB_USER || "root") as string,
      (DB_PASS || "") as string,
      {
        host: DB_HOST || "localhost",
        port: DB_PORT ? Number(DB_PORT) : 3306,
        dialect: "mysql",
        logging: false,
      },
    ];

sequelize = new Sequelize(...sequelizeArgs);

export default sequelize;
