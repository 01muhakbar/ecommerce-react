import { Sequelize, DataTypes, ModelCtor, Model } from 'sequelize';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import configJson from '../../config/config.json' assert { type: 'json' };

// Recreate __filename and __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = configJson[env as keyof typeof configJson];

let sequelize: Sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable] as string, config);
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

// Inisialisasi objek kosong untuk menampung semua model
const db: { [key: string]: ModelCtor<Model> | any } = {};

// Muat semua file model secara dinamis dari direktori ini
fs.readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      // Filter untuk file .js atau .ts (kecuali file deklarasi .d.ts)
      (file.slice(-3) === '.js' || (file.slice(-3) === '.ts' && file.indexOf('.d.ts') === -1))
    );
  })
  .forEach(file => {
    const filePath = path.join(__dirname, file);
    // Dynamic import for ESM
    // This part is tricky with sync loops. A better long-term solution would be async loading.
    // For now, let's assume the models can be required synchronously if they are .js or .ts compiled to CJS-like output by ts-node.
    // However, the root cause is mixing ESM and CJS. With the server now being ESM, this loader needs a rewrite.
    // Let's try a dynamic import approach, but it requires an async context.
    // For a quick fix that might work with ts-node, we'll keep `require`, but this is fragile.
    const importedModule = require(filePath); // This remains a potential issue spot.

    let model: ModelCtor<Model> | undefined;

    // Case 1: CommonJS factory function (like product.js)
    // If the module exports a function, call it to get the model
    if (typeof importedModule === 'function') {
      model = importedModule(sequelize, DataTypes);
    }
    // Case 2: TypeScript class with static initModel (like Product.ts, User.ts)
    // If the module exports an object (e.g., { Product: ProductClass }), find the class
    else if (typeof importedModule === 'object' && importedModule !== null) {
      for (const key in importedModule) {
        if (Object.prototype.hasOwnProperty.call(importedModule, key)) {
          const exported = importedModule[key];
          // Check if it's a class that extends Model and has initModel static method
          if (typeof exported === 'function' && exported.prototype instanceof Model && exported.initModel) {
            model = exported.initModel(sequelize);
            break; // Assuming one primary model class per file
          }
        }
      }
    }

    if (model && model.name) {
      db[model.name] = model;
    } else {
      console.warn(`[Sequelize Model Loader] Skipping file '${file}' because it does not export a valid Sequelize model.`);
    }
  });

// Setelah semua model dimuat, atur asosiasi antar model
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db); // Pass db object for associations
  }
});

// Tetapkan instance sequelize dan library Sequelize ke objek db
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Ekspor objek db yang berisi semua model
export default db;