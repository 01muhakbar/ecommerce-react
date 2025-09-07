import { Sequelize, Model } from "sequelize";
import fs from "fs/promises"; // Gunakan fs/promises untuk operasi asinkron
import path from "path";
import { fileURLToPath } from "url";
// Recreate __filename and __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load database configuration manually to avoid unsupported import assertion
const configPath = path.join(__dirname, "..", "..", "config", "config.json");
const configJson = JSON.parse(await fs.readFile(configPath, "utf-8"));
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || "development";
const config = configJson[env];
let sequelize;
if (config.use_env_variable) {
    sequelize = new Sequelize(process.env[config.use_env_variable], config);
}
else {
    sequelize = new Sequelize(config.database, config.username, config.password, config);
}
const db = {};
export const initializeDatabase = async () => {
    const files = await fs.readdir(__dirname);
    for (const file of files) {
        if (file.indexOf(".") !== 0 &&
            file !== basename &&
            (file.slice(-3) === ".js" ||
                (file.slice(-3) === ".ts" && file.indexOf(".d.ts") === -1))) {
            const filePath = path.join(__dirname, file);
            const fileUrl = `file://${filePath}`; // Gunakan URL untuk dynamic import
            const importedModule = await import(fileUrl);
            let model;
            // Cek apakah modul mengekspor kelas model secara default atau sebagai named export
            const exported = importedModule.default || importedModule;
            // Cari kelas model yang valid di dalam modul yang diimpor
            for (const key in exported) {
                if (Object.prototype.hasOwnProperty.call(exported, key)) {
                    const potentialModel = exported[key];
                    if (typeof potentialModel === "function" &&
                        potentialModel.prototype instanceof Model &&
                        potentialModel.initModel) {
                        model = potentialModel.initModel(sequelize);
                        break;
                    }
                }
            }
            if (model && model.name) {
                db[model.name] = model;
            }
        }
    }
    // Setelah semua model dimuat, atur asosiasi antar model
    Object.keys(db).forEach((modelName) => {
        if (db[modelName].associate) {
            db[modelName].associate(db); // Pass db object for associations
        }
    });
    // Tetapkan instance sequelize dan library Sequelize ke objek db
    db.sequelize = sequelize;
    db.Sequelize = Sequelize;
    return db;
};
// Ekspor db sebagai default untuk kompatibilitas, meskipun isinya kosong sampai inisialisasi
const initializedDbPromise = initializeDatabase();
export default initializedDbPromise;
