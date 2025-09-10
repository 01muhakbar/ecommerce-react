import { Sequelize } from "sequelize";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";

// Dapatkan __dirname di lingkungan ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Muat variabel lingkungan dari .env
dotenv.config({ path: path.resolve(__dirname, "..", "..", ".env") });

const db: { [key: string]: any } = {};

export const initializeDatabase = async () => {
  try {
    // 1. Validasi variabel lingkungan & Log yang aman
    const requiredEnvVars = [
      "DB_HOST",
      "DB_USER",
      "DB_PASS",
      "DB_NAME",
      "DB_DIALECT",
    ];
    const missingVars = requiredEnvVars.filter((v) => !process.env[v]);

    if (missingVars.length > 0) {
      throw new Error(
        `Gagal inisialisasi database: Variabel .env berikut tidak ditemukan: ${missingVars.join(", ")}`
      );
    }

    const { DB_HOST, DB_USER, DB_PASS, DB_NAME, DB_DIALECT, DB_PORT } = process.env;

    console.log("🔍 Menggunakan konfigurasi database berikut:", {
      host: DB_HOST,
      user: DB_USER,
      pass: DB_PASS ? '********' : '(KOSONG)',
      name: DB_NAME,
      dialect: DB_DIALECT,
      port: DB_PORT || '3306 (default)',
    });

    // __filename & __dirname untuk ESM
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const basename = path.basename(__filename);

    // 2. Inisialisasi Sequelize dengan port
    const sequelize = new Sequelize(DB_NAME!, DB_USER!, DB_PASS!, {
      host: DB_HOST!,
      port: DB_PORT ? parseInt(DB_PORT, 10) : 3306,
      dialect: DB_DIALECT! as any,
      logging: false, // non-aktifkan logging SQL sequelize jika tidak perlu
    });

    const files = await fs.readdir(__dirname, { withFileTypes: true });

    for (const dirent of files) {
      if (!dirent.isFile()) continue;

      const file = dirent.name;

      // skip file yang diawali titik, skip diri sendiri,
      // dan hanya ambil .js atau .ts (kecuali .d.ts)
      const isCandidate =
        file[0] !== "." &&
        file !== basename &&
        (file.endsWith(".js") ||
          (file.endsWith(".ts") && !file.endsWith(".d.ts")));

      if (!isCandidate) continue;

      try {
        const filePath = path.join(__dirname, file);
        // ✅ cara aman buat URL file (Windows-friendly)
        const fileUrl = pathToFileURL(filePath).href;

        const importedModule = await import(fileUrl);

        // handle default export (ESM) atau module.exports (CJS)
        const modelDefiner = importedModule.default || importedModule;

        // jika modul mengekspor beberapa model, ambil yang ada initModel
        const candidates = Object.values(modelDefiner ?? {});
        let ModelClass: any =
          candidates.find((x: any) => x && typeof x.initModel === "function") ||
          modelDefiner;

        if (ModelClass && typeof ModelClass.initModel === "function") {
          const model = ModelClass.initModel(sequelize);
          db[model.name] = model;
        }
      } catch (error) {
        console.error(`Error loading model from file ${file}:`, error);
        throw error; // fail fast
      }
    }

    // panggil associate jika ada
    Object.keys(db).forEach((modelName) => {
      if (typeof db[modelName].associate === "function") {
        db[modelName].associate(db);
      }
    });

    db.sequelize = sequelize;
    db.Sequelize = Sequelize;

    await sequelize.authenticate();
    console.log("Database connection has been established successfully.");

    return db;
  } catch (error) {
    console.error("Unable to initialize the database:", error);
    throw error; // propagate ke caller (app.ts)
  }
};
