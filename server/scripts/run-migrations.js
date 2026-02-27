const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { Sequelize } = require("sequelize");

dotenv.config();

const migrationsDir = path.resolve(__dirname, "../migrations");

const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS || "";
const dbHost = process.env.DB_HOST;

if (!dbName || !dbUser || !dbHost) {
  console.error("Missing DB env vars (DB_NAME, DB_USER, DB_HOST).");
  process.exit(1);
}

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  dialect: "mysql",
  logging: false,
  dialectOptions: {
    multipleStatements: true,
  },
});

async function ensureMigrationsTable() {
  await sequelize.query(
    "CREATE TABLE IF NOT EXISTS migrations (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, filename VARCHAR(255) NOT NULL UNIQUE, created_at DATETIME NOT NULL)"
  );
}

const restrictedCjs = process.env.CJS_MIGRATIONS
  ? new Set(
      process.env.CJS_MIGRATIONS.split(",")
        .map((name) => name.trim())
        .filter(Boolean)
    )
  : null;

async function getMigrationFiles() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs
    .readdirSync(migrationsDir)
    .filter((name) => {
      if (name.endsWith(".sql")) return true;
      if (name.endsWith(".cjs")) {
        // Default behavior: run all CJS migrations.
        // Optional compatibility mode: restrict to explicit filenames from env.
        if (!restrictedCjs) return true;
        return restrictedCjs.has(name);
      }
      return false;
    })
    .sort();
}

async function hasMigration(filename) {
  const [rows] = await sequelize.query(
    "SELECT id FROM migrations WHERE filename = ? LIMIT 1",
    { replacements: [filename] }
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function markMigration(filename) {
  await sequelize.query(
    "INSERT INTO migrations (filename, created_at) VALUES (?, NOW())",
    { replacements: [filename] }
  );
}

async function run() {
  try {
    await sequelize.authenticate();
    await ensureMigrationsTable();

    const files = await getMigrationFiles();
    if (restrictedCjs) {
      console.log(
        `CJS_MIGRATIONS active. Running only selected .cjs migrations: ${Array.from(
          restrictedCjs
        ).join(", ")}`
      );
    }
    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }
    for (const filename of files) {
      const applied = await hasMigration(filename);
      if (applied) {
        console.log(`Skipped: ${filename} (already applied)`);
        continue;
      }
      const fullPath = path.join(migrationsDir, filename);
      if (filename.endsWith(".sql")) {
        const sql = fs.readFileSync(fullPath, "utf8");
        if (!sql.trim()) {
          await markMigration(filename);
          console.log(`Applied: ${filename}`);
          continue;
        }
        await sequelize.query(sql);
        await markMigration(filename);
        console.log(`Applied: ${filename}`);
        continue;
      }

      if (filename.endsWith(".cjs")) {
        const migration = require(fullPath);
        if (typeof migration.up !== "function") {
          throw new Error(`Migration missing up(): ${filename}`);
        }
        const queryInterface = sequelize.getQueryInterface();
        await migration.up(queryInterface, Sequelize);
        await markMigration(filename);
        console.log(`Applied: ${filename}`);
        continue;
      }
    }
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

run();
