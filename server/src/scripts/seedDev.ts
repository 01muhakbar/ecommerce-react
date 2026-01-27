import "dotenv/config";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { Category, Product, User, sequelize, syncDb } from "../models/index.ts";

const SEED_EMAIL = "store-seed@local.dev";
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_EMAIL || "superadmin@local.dev";
const SEED_PASSWORD = "seedstore123";

const CATEGORIES = [
  { code: "apparel", name: "Apparel", icon: null },
  { code: "electronics", name: "Electronics", icon: null },
  { code: "home", name: "Home & Living", icon: null },
  { code: "beauty", name: "Beauty", icon: null },
];

const PRODUCTS = [
  { name: "Basic Tee", slug: "basic-tee", price: 120000, stock: 40, categoryCode: "apparel" },
  { name: "Denim Jacket", slug: "denim-jacket", price: 350000, stock: 20, categoryCode: "apparel" },
  { name: "Running Shoes", slug: "running-shoes", price: 480000, stock: 15, categoryCode: "apparel" },
  { name: "Wireless Earbuds", slug: "wireless-earbuds", price: 560000, stock: 30, categoryCode: "electronics" },
  { name: "Smartwatch Sport", slug: "smartwatch-sport", price: 890000, stock: 18, categoryCode: "electronics" },
  { name: "Bluetooth Speaker", slug: "bluetooth-speaker", price: 320000, stock: 25, categoryCode: "electronics" },
  { name: "Ceramic Vase", slug: "ceramic-vase", price: 175000, stock: 22, categoryCode: "home" },
  { name: "Linen Bedsheet", slug: "linen-bedsheet", price: 260000, stock: 16, categoryCode: "home" },
  { name: "Wooden Lamp", slug: "wooden-lamp", price: 295000, stock: 10, categoryCode: "home" },
  { name: "Hydrating Serum", slug: "hydrating-serum", price: 210000, stock: 35, categoryCode: "beauty" },
  { name: "Daily Sunscreen", slug: "daily-sunscreen", price: 150000, stock: 40, categoryCode: "beauty" },
  { name: "Aloe Face Wash", slug: "aloe-face-wash", price: 98000, stock: 28, categoryCode: "beauty" },
];

const DEFAULT_PRODUCT_IMAGE = "/uploads/products/demo.svg";

async function seedDev() {
  await sequelize.authenticate();
  await syncDb();

  const adminUser =
    (await User.findOne({
      where: { role: { [Op.in]: ["super_admin", "admin"] } },
      order: [["id", "ASC"]],
    })) ||
    (await User.findOne({
      where: { email: SUPER_ADMIN_EMAIL },
    }));

  let seller = adminUser;
  if (!seller) {
    const hashed = await bcrypt.hash(SEED_PASSWORD, 10);
    const [fallback] = await User.findOrCreate({
      where: { email: SEED_EMAIL },
      defaults: {
        name: "Store Seed",
        email: SEED_EMAIL,
        password: hashed,
        role: "staff",
        status: "active",
      },
    });
    seller = fallback;
  }

  if (!seller) {
    throw new Error("Unable to resolve a user for seeded products.");
  }

  let categoriesCreated = 0;
  let categoriesUpdated = 0;
  const categoryMap = new Map<string, number>();
  for (const category of CATEGORIES) {
    const [record, created] = await Category.findOrCreate({
      where: { code: category.code },
      defaults: {
        code: category.code,
        name: category.name,
        icon: category.icon,
        published: true,
      },
    });
    if (created) {
      categoriesCreated += 1;
    }
    if (record.name !== category.name || record.published !== true || record.icon !== category.icon) {
      await record.update({
        name: category.name,
        published: true,
        icon: category.icon,
      });
      categoriesUpdated += 1;
    }
    categoryMap.set(category.code, record.id);
  }

  let productsCreated = 0;
  let productsUpdated = 0;
  for (const product of PRODUCTS) {
    const categoryId = categoryMap.get(product.categoryCode);
    const existing = await Product.findOne({ where: { slug: product.slug } });
    if (existing) {
      await existing.update({
        name: product.name,
        price: product.price,
        stock: product.stock,
        categoryId,
        promoImagePath: DEFAULT_PRODUCT_IMAGE,
        status: "active",
        isPublished: true,
      });
      productsUpdated += 1;
      continue;
    }

    await Product.create({
      name: product.name,
      slug: product.slug,
      price: product.price,
      stock: product.stock,
      categoryId,
      promoImagePath: DEFAULT_PRODUCT_IMAGE,
      status: "active",
      isPublished: true,
      userId: seller.id,
    } as any);
    productsCreated += 1;
  }

  console.log("[seed:dev] Categories created:", categoriesCreated);
  console.log("[seed:dev] Categories updated:", categoriesUpdated);
  console.log("[seed:dev] Products created:", productsCreated);
  console.log("[seed:dev] Products updated:", productsUpdated);
  console.log("[seed:dev] Seed user id:", seller.id);
}

seedDev()
  .catch((error) => {
    console.error("[seed:dev] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
