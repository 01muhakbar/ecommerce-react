import "dotenv/config";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { Category, Product, User, sequelize, syncDb } from "../models/index.js";

const SEED_EMAIL = "store-seed@local.dev";
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_EMAIL || "superadmin@local.dev";
const SEED_PASSWORD = "seedstore123";

const CATEGORIES = [
  { code: "fruits", name: "Fruits", icon: null as any },
  { code: "vegetables", name: "Vegetables", icon: null as any },
  { code: "bakery", name: "Bakery", icon: null as any },
  { code: "dairy", name: "Dairy", icon: null as any },
  { code: "meat", name: "Meat", icon: null as any },
  { code: "beverages", name: "Beverages", icon: null as any },
  { code: "snacks", name: "Snacks", icon: null as any },
];

const PRODUCTS = [
  { name: "Organic Banana", slug: "organic-banana", price: 12000, stock: 40, categoryCode: "fruits" },
  { name: "Fresh Tomato", slug: "fresh-tomato", price: 8000, stock: 40, categoryCode: "vegetables" },
  { name: "Brown Bread", slug: "brown-bread", price: 15000, stock: 40, categoryCode: "bakery" },
  { name: "Milk 1L", slug: "milk-1l", price: 18000, stock: 40, categoryCode: "dairy" },
  { name: "Chicken Breast", slug: "chicken-breast", price: 42000, stock: 40, categoryCode: "meat" },
  { name: "Orange Juice", slug: "orange-juice", price: 22000, stock: 40, categoryCode: "beverages" },
  { name: "Potato Chips", slug: "potato-chips", price: 14000, stock: 40, categoryCode: "snacks" },
  { name: "Green Apple", slug: "green-apple", price: 16000, stock: 40, categoryCode: "fruits" },
];

const DEFAULT_PRODUCT_IMAGE = "/uploads/products/demo.svg";

async function seedKachaDemo() {
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
    const existing = await Category.findOne({ where: { code: category.code } });
    if (existing) {
      if (existing.name !== category.name || existing.published !== true || existing.icon !== category.icon) {
        await existing.update({
          name: category.name,
          published: true,
          icon: category.icon,
        });
        categoriesUpdated += 1;
      }
      categoryMap.set(category.code, existing.id);
      continue;
    }

    const created = await Category.create({
      code: category.code,
      name: category.name,
      icon: category.icon,
      published: true,
    } as any);
    categoriesCreated += 1;
    categoryMap.set(category.code, created.id);
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
        userId: seller.id,
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

  console.log("[seed:kacha] Categories created:", categoriesCreated);
  console.log("[seed:kacha] Categories updated:", categoriesUpdated);
  console.log("[seed:kacha] Products created:", productsCreated);
  console.log("[seed:kacha] Products updated:", productsUpdated);
  console.log("[seed:kacha] Seed user id:", seller.id);
}

seedKachaDemo()
  .catch((error) => {
    console.error("[seed:kacha] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
