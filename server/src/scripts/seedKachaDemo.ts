import "dotenv/config";
import bcrypt from "bcrypt";
import { Op } from "sequelize";
import { Category, Product, ProductReview, User, sequelize, syncDb } from "../models/index.js";

const SEED_EMAIL = "store-seed@local.dev";
const SUPER_ADMIN_EMAIL = process.env.SEED_SUPER_EMAIL || "superadmin@local.dev";
const SEED_PASSWORD = "seedstore123";
const REVIEWER_PASSWORD = "reviewer123";

type DemoCategory = {
  code: string;
  name: string;
  description: string;
  icon: string;
};

type DemoProduct = {
  name: string;
  slug: string;
  description: string;
  categoryCode: string;
  price: number;
  salePrice: number | null;
  stock: number;
  imagePath: string;
  unit: string;
  ratings: number[];
};

const CATEGORIES: DemoCategory[] = [
  { code: "fruits", name: "Fresh Fruits", description: "Daily fresh fruit picks", icon: "🍎" },
  { code: "vegetables", name: "Fresh Vegetables", description: "Farm vegetables and greens", icon: "🥦" },
  { code: "bakery", name: "Bread & Bakery", description: "Baked daily essentials", icon: "🥖" },
  { code: "dairy", name: "Milk & Dairy", description: "Milk, yogurt, and cheese", icon: "🥛" },
  { code: "meat", name: "Meat & Fish", description: "Protein and seafood selection", icon: "🍗" },
  { code: "beverages", name: "Beverages", description: "Juices and ready-to-drink", icon: "🧃" },
  { code: "snacks", name: "Snacks", description: "Crispy and healthy snacks", icon: "🍪" },
  { code: "pantry", name: "Pantry", description: "Staples for home cooking", icon: "🫒" },
];

const PRODUCTS: DemoProduct[] = [
  {
    name: "Organic Banana",
    slug: "organic-banana",
    description: "Naturally sweet banana bunch from selected farms.",
    categoryCode: "fruits",
    price: 22000,
    salePrice: 18000,
    stock: 120,
    imagePath: "/uploads/products/demo-kacha/fruits.svg",
    unit: "1 kg",
    ratings: [5, 4, 5, 4, 5],
  },
  {
    name: "Red Apple Premium",
    slug: "red-apple-premium",
    description: "Crispy premium apples for daily snacks.",
    categoryCode: "fruits",
    price: 36000,
    salePrice: 29900,
    stock: 90,
    imagePath: "/uploads/products/demo-kacha/fruits.svg",
    unit: "1 kg",
    ratings: [5, 4, 4, 5],
  },
  {
    name: "Fresh Tomato",
    slug: "fresh-tomato",
    description: "Ripe tomatoes perfect for salad and cooking.",
    categoryCode: "vegetables",
    price: 18000,
    salePrice: 14500,
    stock: 140,
    imagePath: "/uploads/products/demo-kacha/vegetables.svg",
    unit: "500 g",
    ratings: [4, 4, 5],
  },
  {
    name: "Baby Spinach",
    slug: "baby-spinach",
    description: "Tender baby spinach packed in freshness.",
    categoryCode: "vegetables",
    price: 24000,
    salePrice: null,
    stock: 85,
    imagePath: "/uploads/products/demo-kacha/vegetables.svg",
    unit: "250 g",
    ratings: [4, 5, 4, 4],
  },
  {
    name: "Brown Bread",
    slug: "brown-bread",
    description: "Soft whole wheat bread loaf for healthy breakfast.",
    categoryCode: "bakery",
    price: 28000,
    salePrice: 22900,
    stock: 70,
    imagePath: "/uploads/products/demo-kacha/bakery.svg",
    unit: "1 loaf",
    ratings: [5, 4, 4, 4],
  },
  {
    name: "Butter Croissant",
    slug: "butter-croissant",
    description: "Flaky croissant baked fresh every morning.",
    categoryCode: "bakery",
    price: 16000,
    salePrice: null,
    stock: 95,
    imagePath: "/uploads/products/demo-kacha/bakery.svg",
    unit: "2 pcs",
    ratings: [5, 5, 4],
  },
  {
    name: "Milk 1L",
    slug: "milk-1l",
    description: "Fresh full cream milk for family needs.",
    categoryCode: "dairy",
    price: 24000,
    salePrice: 19900,
    stock: 110,
    imagePath: "/uploads/products/demo-kacha/dairy.svg",
    unit: "1 L",
    ratings: [4, 5, 4, 5, 4],
  },
  {
    name: "Greek Yogurt Plain",
    slug: "greek-yogurt-plain",
    description: "Creamy high-protein plain yogurt cup.",
    categoryCode: "dairy",
    price: 32000,
    salePrice: 27900,
    stock: 88,
    imagePath: "/uploads/products/demo-kacha/dairy.svg",
    unit: "500 g",
    ratings: [5, 4, 4, 5],
  },
  {
    name: "Chicken Breast Fillet",
    slug: "chicken-breast-fillet",
    description: "Skinless chicken breast for healthy meals.",
    categoryCode: "meat",
    price: 52000,
    salePrice: 46500,
    stock: 76,
    imagePath: "/uploads/products/demo-kacha/protein.svg",
    unit: "500 g",
    ratings: [4, 5, 5, 4],
  },
  {
    name: "Salmon Fillet",
    slug: "salmon-fillet",
    description: "Premium salmon cut rich in omega-3.",
    categoryCode: "meat",
    price: 98000,
    salePrice: 89900,
    stock: 42,
    imagePath: "/uploads/products/demo-kacha/protein.svg",
    unit: "300 g",
    ratings: [5, 5, 4, 5],
  },
  {
    name: "Orange Juice",
    slug: "orange-juice",
    description: "Refreshing orange juice without added sugar.",
    categoryCode: "beverages",
    price: 26000,
    salePrice: 21900,
    stock: 130,
    imagePath: "/uploads/products/demo-kacha/beverage.svg",
    unit: "1 L",
    ratings: [4, 4, 5, 4],
  },
  {
    name: "Oat Milk Original",
    slug: "oat-milk-original",
    description: "Plant-based oat milk for modern lifestyle.",
    categoryCode: "beverages",
    price: 34000,
    salePrice: null,
    stock: 67,
    imagePath: "/uploads/products/demo-kacha/beverage.svg",
    unit: "1 L",
    ratings: [4, 5, 4],
  },
  {
    name: "Potato Chips Sea Salt",
    slug: "potato-chips-sea-salt",
    description: "Crunchy sea salt chips for snack time.",
    categoryCode: "snacks",
    price: 18000,
    salePrice: 14900,
    stock: 160,
    imagePath: "/uploads/products/demo-kacha/snacks.svg",
    unit: "150 g",
    ratings: [4, 4, 4, 5],
  },
  {
    name: "Granola Bar Mixed Nuts",
    slug: "granola-bar-mixed-nuts",
    description: "Whole grain bar with mixed nuts and honey.",
    categoryCode: "snacks",
    price: 22000,
    salePrice: 18900,
    stock: 112,
    imagePath: "/uploads/products/demo-kacha/snacks.svg",
    unit: "6 bars",
    ratings: [5, 4, 4],
  },
  {
    name: "Basmati Rice",
    slug: "basmati-rice",
    description: "Long-grain aromatic rice for daily cooking.",
    categoryCode: "pantry",
    price: 46000,
    salePrice: 40900,
    stock: 140,
    imagePath: "/uploads/products/demo-kacha/pantry.svg",
    unit: "2 kg",
    ratings: [4, 4, 5, 4],
  },
  {
    name: "Extra Virgin Olive Oil",
    slug: "extra-virgin-olive-oil",
    description: "Cold-pressed olive oil for healthy recipes.",
    categoryCode: "pantry",
    price: 88000,
    salePrice: 79900,
    stock: 58,
    imagePath: "/uploads/products/demo-kacha/pantry.svg",
    unit: "500 ml",
    ratings: [5, 4, 5],
  },
];

const REVIEWER_ACCOUNTS = [
  { name: "Rina Pratiwi", email: "reviewer.rina@local.dev" },
  { name: "Andi Saputra", email: "reviewer.andi@local.dev" },
  { name: "Maya Lestari", email: "reviewer.maya@local.dev" },
  { name: "Budi Santoso", email: "reviewer.budi@local.dev" },
  { name: "Sinta Dewi", email: "reviewer.sinta@local.dev" },
];

const toActiveSalePrice = (price: number, salePrice: number | null) => {
  if (!Number.isFinite(Number(salePrice))) return null;
  const normalized = Number(salePrice);
  if (normalized <= 0 || normalized >= Number(price)) return null;
  return normalized;
};

const getNumericAttr = (model: any, key: string) => {
  const raw =
    model?.getDataValue?.(key) ??
    model?.get?.(key) ??
    model?.dataValues?.[key] ??
    model?.[key] ??
    null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

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
      const shouldUpdate =
        existing.name !== category.name ||
        existing.published !== true ||
        existing.icon !== category.icon ||
        existing.description !== category.description;
      if (shouldUpdate) {
        await existing.update({
          name: category.name,
          description: category.description,
          published: true,
          icon: category.icon,
        });
        categoriesUpdated += 1;
      }
      const existingId = getNumericAttr(existing, "id");
      if (!existingId) {
        throw new Error(`Missing category id for code=${category.code}`);
      }
      categoryMap.set(category.code, existingId);
      continue;
    }

    const created = await Category.create({
      code: category.code,
      name: category.name,
      icon: category.icon,
      published: true,
    } as any);
    categoriesCreated += 1;
    const createdId = getNumericAttr(created, "id");
    if (!createdId) {
      throw new Error(`Failed to resolve created category id for code=${category.code}`);
    }
    categoryMap.set(category.code, createdId);
  }

  let productsCreated = 0;
  let productsUpdated = 0;
  const seededProducts: Array<{ id: number; slug: string; ratings: number[] }> = [];
  for (const product of PRODUCTS) {
    const categoryId = categoryMap.get(product.categoryCode);
    if (!categoryId) {
      throw new Error(`Missing category mapping for ${product.slug} (${product.categoryCode})`);
    }
    const salePrice = toActiveSalePrice(product.price, product.salePrice);
    const existing = await Product.findOne({ where: { slug: product.slug } });
    if (existing) {
      await existing.update({
        name: product.name,
        description: product.description,
        price: product.price,
        salePrice: salePrice ?? undefined,
        stock: product.stock,
        categoryId,
        promoImagePath: product.imagePath,
        imagePaths: [product.imagePath],
        tags: { unit: product.unit, source: "seed:kachabazar" },
        status: "active",
        isPublished: true,
        userId: seller.id,
      });
      const existingId = getNumericAttr(existing, "id");
      if (!existingId) {
        throw new Error(`Missing product id for slug=${product.slug}`);
      }
      seededProducts.push({ id: existingId, slug: product.slug, ratings: product.ratings });
      productsUpdated += 1;
      continue;
    }

    const created = await Product.create({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      salePrice: salePrice ?? undefined,
      stock: product.stock,
      categoryId,
      promoImagePath: product.imagePath,
      imagePaths: [product.imagePath],
      tags: { unit: product.unit, source: "seed:kachabazar" },
      status: "active",
      isPublished: true,
      userId: seller.id,
    } as any);
    const createdId = getNumericAttr(created, "id");
    if (!createdId) {
      throw new Error(`Failed to resolve created product id for slug=${product.slug}`);
    }
    seededProducts.push({ id: createdId, slug: product.slug, ratings: product.ratings });
    productsCreated += 1;
  }

  const reviewerIds: number[] = [];
  for (const reviewer of REVIEWER_ACCOUNTS) {
    const [account] = await User.findOrCreate({
      where: { email: reviewer.email },
      defaults: {
        name: reviewer.name,
        email: reviewer.email,
        password: await bcrypt.hash(REVIEWER_PASSWORD, 10),
        role: "user",
        status: "active",
      },
    });
    reviewerIds.push(account.id);
  }

  const seededProductIds = seededProducts.map((item) => item.id);
  await ProductReview.destroy({
    where: {
      productId: { [Op.in]: seededProductIds },
    },
  });

  let reviewsCreated = 0;
  for (const product of seededProducts) {
    for (let i = 0; i < product.ratings.length; i += 1) {
      const rating = product.ratings[i];
      const reviewerId = reviewerIds[i % reviewerIds.length];
      await ProductReview.create({
        userId: reviewerId,
        productId: product.id,
        rating,
        comment: `Great ${product.slug.replace(/-/g, " ")} quality. Rating ${rating}/5.`,
        images: null,
      } as any);
      reviewsCreated += 1;
    }
  }

  console.log("[seed:kacha] Categories created:", categoriesCreated);
  console.log("[seed:kacha] Categories updated:", categoriesUpdated);
  console.log("[seed:kacha] Products created:", productsCreated);
  console.log("[seed:kacha] Products updated:", productsUpdated);
  console.log("[seed:kacha] Reviews created:", reviewsCreated);
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
