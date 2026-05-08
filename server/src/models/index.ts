// server/src/models/index.ts
import "dotenv/config";
import sequelize from "../config/database.js";
import { initUser, User } from "./User.js";
import { Store } from "./Store.js";
import { StoreRole } from "./StoreRole.js";
import { StoreMember } from "./StoreMember.js";
import { StoreAuditLog } from "./StoreAuditLog.js";
import { StorePaymentProfile } from "./StorePaymentProfile.js";
import { StorePaymentProfileRequest } from "./StorePaymentProfileRequest.js";
import { StoreApplication } from "./StoreApplication.js";
import { Product } from "./Product.js";
import { Category } from "./Category.js";
import { ProductCategory } from "./ProductCategory.js";
import { Cart } from "./Cart.js";
import { CartItem } from "./CartItem.js";
import { Order } from "./Order.js";
import { OrderItem } from "./OrderItem.js";
import { Suborder } from "./Suborder.js";
import { SuborderItem } from "./SuborderItem.js";
import { Payment } from "./Payment.js";
import { PaymentProof } from "./PaymentProof.js";
import { PaymentStatusLog } from "./PaymentStatusLog.js";
import { Shipment } from "./Shipment.js";
import { TrackingEvent } from "./TrackingEvent.js";
import { Coupon } from "./Coupon.js";
import { ProductReview } from "./ProductReview.js";
import { Attribute } from "./Attribute.js";
import { Language } from "./Language.js";
import { Currency } from "./Currency.js";
import { Notification } from "./Notification.js";
import { UserAddress } from "./UserAddress.js";
import { UserRegistrationVerification } from "./UserRegistrationVerification.js";
import { ensureSystemStoreRoles } from "../services/seller/storeRoles.js";

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
  Store.initModel(sequelize);
  StoreRole.initModel(sequelize);
  StoreMember.initModel(sequelize);
  StoreAuditLog.initModel(sequelize);
  StorePaymentProfile.initModel(sequelize);
  StorePaymentProfileRequest.initModel(sequelize);
  StoreApplication.initModel(sequelize);
  Product.initModel(sequelize);
  Category.initModel(sequelize);
  ProductCategory.initModel(sequelize);
  Cart.initModel(sequelize);
  CartItem.initModel(sequelize);
  Order.initModel(sequelize);
  OrderItem.initModel(sequelize);
  Suborder.initModel(sequelize);
  SuborderItem.initModel(sequelize);
  Payment.initModel(sequelize);
  PaymentProof.initModel(sequelize);
  PaymentStatusLog.initModel(sequelize);
  Shipment.initModel(sequelize);
  TrackingEvent.initModel(sequelize);
  Coupon.initModel(sequelize);
  ProductReview.initModel(sequelize);
  Attribute.initModel(sequelize);
  Language.initModel(sequelize);
  Currency.initModel(sequelize);
  Notification.initModel(sequelize);
  UserAddress.initModel(sequelize);
  UserRegistrationVerification.initModel(sequelize);

  const models: any = {
    User,
    Store,
    StoreRole,
    StoreMember,
    StoreAuditLog,
    StorePaymentProfile,
    StorePaymentProfileRequest,
    StoreApplication,
    Product,
    Category,
    ProductCategory,
    Cart,
    CartItem,
    Order,
    OrderItem,
    Suborder,
    SuborderItem,
    Payment,
    PaymentProof,
    PaymentStatusLog,
    Shipment,
    TrackingEvent,
    Coupon,
    ProductReview,
    Attribute,
    Language,
    Currency,
    Notification,
    UserAddress,
    UserRegistrationVerification,
  };

  Object.values(models).forEach((model: any) => {
    if (typeof model.associate === "function") {
      model.associate(models);
    }
  });
}

// Jalankan init sekali waktu file ini di-import
initModels();

async function backfillProductCategoryAssignments() {
  const products = await Product.findAll({
    attributes: ["id", "categoryId", "defaultCategoryId"],
  });

  const categoryLinks: Array<{ productId: number; categoryId: number }> = [];

  for (const product of products) {
    const productId = Number((product as any).get?.("id") ?? (product as any).id);
    const categoryId = Number(
      (product as any).get?.("categoryId") ?? (product as any).categoryId ?? 0
    );
    const defaultCategoryId = Number(
      (product as any).get?.("defaultCategoryId") ?? (product as any).defaultCategoryId ?? 0
    );
    const resolvedDefaultCategoryId =
      defaultCategoryId > 0 ? defaultCategoryId : categoryId > 0 ? categoryId : null;

    if (resolvedDefaultCategoryId && defaultCategoryId <= 0) {
      await product.update({ defaultCategoryId: resolvedDefaultCategoryId } as any);
    }

    if (resolvedDefaultCategoryId) {
      categoryLinks.push({
        productId,
        categoryId: resolvedDefaultCategoryId,
      });
    }
  }

  if (categoryLinks.length > 0) {
    await ProductCategory.bulkCreate(categoryLinks as any, { ignoreDuplicates: true });
  }
}

function buildStoreBaseName(user: any, ownerUserId: number) {
  const name = String(user?.get?.("name") ?? user?.name ?? "").trim();
  if (name) return name;
  const email = String(user?.get?.("email") ?? user?.email ?? "").trim();
  if (email) {
    return email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return `Store ${ownerUserId}`;
}

function slugifyStoreBase(value: string, ownerUserId: number) {
  const normalized =
    String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `store-${ownerUserId}`;
  return `${normalized}-${ownerUserId}`;
}

async function ensureStoreForOwnerUser(ownerUserId: number) {
  const existing = await Store.findOne({
    where: { ownerUserId },
    attributes: ["id", "ownerUserId", "name", "slug", "status"],
  });
  if (existing) return existing;

  const owner = await User.findByPk(ownerUserId, {
    attributes: ["id", "name", "email"],
  });
  const baseName = buildStoreBaseName(owner, ownerUserId);
  return Store.create({
    ownerUserId,
    name: baseName,
    slug: slugifyStoreBase(baseName, ownerUserId),
    status: "ACTIVE",
  });
}

async function backfillStoreAssignments() {
  const products = await Product.findAll({
    attributes: ["id", "userId", "storeId"],
  });

  for (const product of products) {
    const productId = Number((product as any).get?.("id") ?? (product as any).id ?? 0);
    const ownerUserId = Number(
      (product as any).get?.("userId") ?? (product as any).userId ?? 0
    );
    const currentStoreId = Number(
      (product as any).get?.("storeId") ?? (product as any).storeId ?? 0
    );

    if (!Number.isFinite(productId) || productId <= 0) continue;
    if (!Number.isFinite(ownerUserId) || ownerUserId <= 0) continue;

    const store = await ensureStoreForOwnerUser(ownerUserId);
    const resolvedStoreId = Number(
      (store as any).get?.("id") ?? (store as any).id ?? 0
    );
    if (!Number.isFinite(resolvedStoreId) || resolvedStoreId <= 0) continue;

    if (currentStoreId !== resolvedStoreId) {
      await product.update({ storeId: resolvedStoreId } as any);
    }
  }
}

async function backfillStorePaymentProfileFoundation() {
  const profiles = await StorePaymentProfile.findAll({
    attributes: [
      "id",
      "storeId",
      "version",
      "snapshotStatus",
      "isActive",
      "verificationStatus",
      "verifiedByAdminId",
      "verifiedAt",
      "activatedByAdminId",
      "activatedAt",
    ],
    order: [
      ["storeId", "ASC"],
      ["id", "ASC"],
    ],
  });

  const activeProfileIdsByStore = new Map<number, number>();

  for (const profile of profiles) {
    const profileId = Number((profile as any).get?.("id") ?? (profile as any).id ?? 0);
    const storeId = Number((profile as any).get?.("storeId") ?? (profile as any).storeId ?? 0);
    const version = Number((profile as any).get?.("version") ?? (profile as any).version ?? 0);
    const snapshotStatus = String(
      (profile as any).get?.("snapshotStatus") ?? (profile as any).snapshotStatus ?? ""
    ).toUpperCase();
    const verificationStatus = String(
      (profile as any).get?.("verificationStatus") ??
        (profile as any).verificationStatus ??
        ""
    ).toUpperCase();
    const isActive = Boolean((profile as any).get?.("isActive") ?? (profile as any).isActive);
    const verifiedByAdminId =
      Number((profile as any).get?.("verifiedByAdminId") ?? (profile as any).verifiedByAdminId ?? 0) ||
      null;
    const verifiedAt =
      (profile as any).get?.("verifiedAt") ??
      (profile as any).verifiedAt ??
      null;
    const activatedByAdminId =
      Number(
        (profile as any).get?.("activatedByAdminId") ??
          (profile as any).activatedByAdminId ??
          0
      ) || null;
    const activatedAt =
      (profile as any).get?.("activatedAt") ??
      (profile as any).activatedAt ??
      null;

    const nextVersion = version > 0 ? version : 1;
    const nextSnapshotStatus =
      isActive && verificationStatus === "ACTIVE" ? "ACTIVE" : "INACTIVE";

    const updates: Record<string, unknown> = {};
    if (version !== nextVersion) updates.version = nextVersion;
    if (snapshotStatus !== nextSnapshotStatus) updates.snapshotStatus = nextSnapshotStatus;
    if (nextSnapshotStatus === "ACTIVE" && !activatedAt) {
      updates.activatedAt = verifiedAt || new Date();
    }
    if (nextSnapshotStatus === "ACTIVE" && !activatedByAdminId && verifiedByAdminId) {
      updates.activatedByAdminId = verifiedByAdminId;
    }

    if (Object.keys(updates).length > 0) {
      await profile.update(updates as any);
    }

    if (nextSnapshotStatus === "ACTIVE" && storeId > 0 && profileId > 0) {
      activeProfileIdsByStore.set(storeId, profileId);
    }
  }

  const stores = await Store.findAll({
    attributes: ["id", "activeStorePaymentProfileId"],
  });
  for (const store of stores) {
    const storeId = Number((store as any).get?.("id") ?? (store as any).id ?? 0);
    const activeStorePaymentProfileId =
      Number(
        (store as any).get?.("activeStorePaymentProfileId") ??
          (store as any).activeStorePaymentProfileId ??
          0
      ) || null;
    const expectedProfileId = activeProfileIdsByStore.get(storeId) || null;
    if (activeStorePaymentProfileId !== expectedProfileId) {
      await store.update({ activeStorePaymentProfileId: expectedProfileId } as any);
    }
  }
}

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
    await ensureSystemStoreRoles();
    await backfillProductCategoryAssignments();
    await backfillStoreAssignments();
    await backfillStorePaymentProfileFoundation();
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
    await ensureSystemStoreRoles();
    await backfillStoreAssignments();
    await backfillStorePaymentProfileFoundation();
  } finally {
    await sequelize.query("SET FOREIGN_KEY_CHECKS = 1;");
  }
}

export {
  sequelize,
  User,
  Store,
  StoreRole,
  StoreMember,
  StoreAuditLog,
  StorePaymentProfile,
  StorePaymentProfileRequest,
  StoreApplication,
  Product,
  Category,
  ProductCategory,
  Cart,
  CartItem,
  Order,
  OrderItem,
  Suborder,
  SuborderItem,
  Payment,
  PaymentProof,
  PaymentStatusLog,
  Shipment,
  TrackingEvent,
  Coupon,
  ProductReview,
  Attribute,
  Language,
  Currency,
  Notification,
  UserAddress,
  UserRegistrationVerification,
};
