// server/src/models/index.ts
import "dotenv/config";
import sequelize from "../config/database.js";
import { initUser, User } from "./User.js";
import { Product } from "./Product.js";
import { Category } from "./Category.js";
import { Cart } from "./Cart.js";
import { CartItem } from "./CartItem.js";
import { Order } from "./Order.js";
import { OrderItem } from "./OrderItem.js";
import { Coupon } from "./Coupon.js";
import { ProductReview } from "./ProductReview.js";
import { Attribute } from "./Attribute.js";

type ProductUserIdFkRow = {
  tableName: string;
  constraintName: string;
};

function normalizeTableName(input: any): string {
  if (typeof input === "string") return input;
  if (input && typeof input === "object") {
    if (typeof input.tableName === "string") return input.tableName;
    if (typeof input.table === "string") return input.table;
  }
  return String(input ?? "");
}

async function resolveProductsTableName(queryInterface: any): Promise<string | null> {
  for (const candidate of ["products", "Products"]) {
    try {
      await queryInterface.describeTable(candidate);
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

async function getProductUserIdForeignKeys(
  queryInterface: any,
  tableName: string
): Promise<ProductUserIdFkRow[]> {
  const [rows] = await queryInterface.sequelize.query(
    `
      SELECT
        kcu.TABLE_NAME AS tableName,
        kcu.CONSTRAINT_NAME AS constraintName
      FROM information_schema.KEY_COLUMN_USAGE kcu
      WHERE kcu.TABLE_SCHEMA = DATABASE()
        AND kcu.TABLE_NAME = :tableName
        AND kcu.COLUMN_NAME = 'userId'
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    `,
    { replacements: { tableName } }
  );
  return Array.isArray(rows) ? (rows as ProductUserIdFkRow[]) : [];
}

async function dropProductUserIdForeignKeys(queryInterface: any): Promise<Set<string>> {
  const productsTable = await resolveProductsTableName(queryInterface);
  if (!productsTable) return new Set();

  const rows = await getProductUserIdForeignKeys(queryInterface, productsTable);
  const names = new Set(rows.map((row) => String(row.constraintName)));

  for (const constraintName of names) {
    await queryInterface.removeConstraint(productsTable, constraintName);
  }
  return names;
}

function isUnknownConstraintError(error: any): boolean {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  return name === "SequelizeUnknownConstraintError" || message.includes("does not exist");
}

// Registrasi semua model di sini
function initModels() {
  initUser(sequelize);
  Product.initModel(sequelize);
  Category.initModel(sequelize);
  Cart.initModel(sequelize);
  CartItem.initModel(sequelize);
  Order.initModel(sequelize);
  OrderItem.initModel(sequelize);
  Coupon.initModel(sequelize);
  ProductReview.initModel(sequelize);
  Attribute.initModel(sequelize);

  const models: any = {
    User,
    Product,
    Category,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Coupon,
    ProductReview,
    Attribute,
  };

  Object.values(models).forEach((model: any) => {
    if (typeof model.associate === "function") {
      model.associate(models);
    }
  });
}

// Jalankan init sekali waktu file ini di-import
initModels();

// Helper untuk sync schema → langsung terlihat di phpMyAdmin
export async function syncDb() {
  const queryInterface = sequelize.getQueryInterface() as any;
  const originalRemoveConstraint = queryInterface.removeConstraint.bind(queryInterface);

  // Cleanup FK lama di products.userId hanya jika benar-benar ada.
  await dropProductUserIdForeignKeys(queryInterface);

  // Make constraint removal idempotent during alter sync for legacy DB variants.
  queryInterface.removeConstraint = async (tableName: any, constraintName: string, options?: any) => {
    const normalizedTable = normalizeTableName(tableName).toLowerCase();
    if (normalizedTable === "products") {
      const resolvedProductsTable = await resolveProductsTableName(queryInterface);
      if (resolvedProductsTable) {
        const fkRows = await getProductUserIdForeignKeys(queryInterface, resolvedProductsTable);
        const existingNames = new Set(fkRows.map((row) => String(row.constraintName)));
        if (!existingNames.has(String(constraintName))) {
          return;
        }
      }
    }

    try {
      return await originalRemoveConstraint(tableName, constraintName, options);
    } catch (error) {
      if (isUnknownConstraintError(error)) return;
      throw error;
    }
  };

  try {
    // gunakan alter agar kolom baru otomatis disesuaikan (aman untuk dev)
    await sequelize.sync({ alter: true });
  } finally {
    queryInterface.removeConstraint = originalRemoveConstraint;
  }
}

// Dev-only reset: drop & recreate tables to clean legacy data issues.
export async function resetDbDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("resetDbDev is disabled in production.");
  }
  await sequelize.authenticate();
  await sequelize.query("SET FOREIGN_KEY_CHECKS = 0;");
  try {
    await sequelize.drop();
    await sequelize.sync({ force: true });
  } finally {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
  }
}

export {
  sequelize,
  User,
  Product,
  Category,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Coupon,
  ProductReview,
  Attribute,
};
