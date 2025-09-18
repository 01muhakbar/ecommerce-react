import { Sequelize, Model, ModelCtor } from "sequelize";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __filename and __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define a type for the db object that will hold all models
export interface Db {
  [key: string]: ModelCtor<Model<any, any>> | Sequelize | typeof Sequelize;
  sequelize: Sequelize;
  Sequelize: typeof Sequelize;
}

let dbInstance: Db | null = null;
let dbInitializationPromise: Promise<Db> | null = null;

/**
 * Initializes the database by loading all models from the current directory,
 * initializing them, and setting up their associations.
 * This function is idempotent and will only run the initialization once.
 */
export const initializeDatabase = async (): Promise<Db> => {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbInitializationPromise) {
    return dbInitializationPromise;
  }

  // Wrap the core logic in a promise to handle concurrent calls
  dbInitializationPromise = (async () => {
    // Build config object from environment variables inside the async function
    // to ensure .env has been loaded.
    const config = {
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      dialect: process.env.DB_DIALECT || "mysql",
      logging: console.log, // Set to console.log for debugging
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    };

    // Type check to ensure required env vars are present
    if (!config.database || !config.username) {
      throw new Error(
        "Database configuration is incomplete. Check your .env file for DB_NAME, DB_USER, and DB_PASS."
      );
    }

    // Initialize Sequelize instance here
    const sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        port: config.port,
        dialect: config.dialect as any,
        logging: config.logging,
        pool: config.pool,
      }
    );

    const db: Partial<Db> = {};
    const files = await fs.readdir(__dirname);
    const basename = path.basename(__filename);

    // Dynamically import all model files in the directory
    for (const file of files) {
      if (
        file.indexOf(".") !== 0 &&
        file !== basename &&
        (file.slice(-3) === ".js" || file.slice(-3) === ".ts") &&
        !file.endsWith(".d.ts")
      ) {
        const filePath = path.join(__dirname, file);
        const fileUrl = new URL(`file://${filePath}`).href;
        const importedModule = await import(fileUrl);

        // Robustly find and initialize the model class
        const modelName = path.basename(file, path.extname(file));
        const modelClass = importedModule[modelName];

        if (modelClass && typeof modelClass.initModel === "function") {
          const model = modelClass.initModel(sequelize);
          db[model.name] = model;
        }
      }
    }

    // Set up associations between models
    Object.values(db).forEach((model: any) => {
      if (model.associate) {
        model.associate(db);
      }
    });

    // Log associations for OrderItem for debugging
    if (db.OrderItem) {
      console.log("OrderItem associations:", Object.keys((db.OrderItem as any).associations));
    }

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;

    dbInstance = db as Db;
    return dbInstance;
  })();

  return dbInitializationPromise;
};

// Export a promise that resolves with the initialized db object.
export const initializedDbPromise = initializeDatabase();

// The top-level direct export of sequelize is removed as it's now created lazily.
// It should be accessed via the `initializedDbPromise` like so:
// const db = await initializedDbPromise;
// const { sequelize } = db;