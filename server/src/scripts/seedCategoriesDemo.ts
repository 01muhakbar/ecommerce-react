import "dotenv/config";
import { Category, sequelize, syncDb } from "../models/index.js";

type DemoCategorySeed = {
  code: string;
  name: string;
  description?: string;
  icon?: string | null;
  published?: boolean;
};

type DemoParentSeed = DemoCategorySeed & {
  children?: DemoCategorySeed[];
};

const DEMO_CATEGORY_TREE: DemoParentSeed[] = [
  {
    code: "fish-meat",
    name: "Fish & Meat",
    children: [
      { code: "fish", name: "Fish" },
      { code: "meat", name: "Meat" },
    ],
  },
  {
    code: "fruits-vegetable",
    name: "Fruits & Vegetable",
    children: [
      { code: "baby-food", name: "Baby Food" },
      { code: "fresh-fruits", name: "Fresh Fruits" },
      { code: "dry-fruits", name: "Dry Fruits" },
      { code: "fresh-vegetable", name: "Fresh Vegetable" },
    ],
  },
  { code: "cooking-essentials", name: "Cooking Essentials" },
  { code: "biscuits-cakes", name: "Biscuits & Cakes" },
  { code: "household-tools", name: "Household Tools" },
  { code: "pet-care", name: "Pet Care" },
  { code: "beauty-healths", name: "Beauty & Healths" },
  { code: "jam-jelly", name: "Jam & Jelly" },
];

const normalizeSeed = (seed: DemoCategorySeed, parentId: number | null = null) => ({
  code: seed.code,
  name: seed.name,
  description: seed.description ?? seed.name,
  icon: seed.icon ?? null,
  published: seed.published ?? true,
  parentId,
});

const getCategoryId = (category: Category) => {
  const raw =
    (category as any)?.getDataValue?.("id") ??
    (category as any)?.get?.("id") ??
    (category as any)?.dataValues?.id ??
    (category as any)?.id;
  const id = Number(raw);
  if (!Number.isFinite(id)) {
    throw new Error(`[seed:categories-demo] Invalid category id for code: ${(category as any)?.code}`);
  }
  return id;
};

const getCategoryAttr = (category: Category, key: string) =>
  (category as any)?.getDataValue?.(key) ??
  (category as any)?.get?.(key) ??
  (category as any)?.dataValues?.[key] ??
  (category as any)?.[key];

async function upsertCategoryByCode(
  seed: DemoCategorySeed,
  parentId: number | null
): Promise<{ category: Category; created: boolean; updated: boolean }> {
  const payload = normalizeSeed(seed, parentId);
  const existing = await Category.findOne({ where: { code: payload.code } });

  if (!existing) {
    const category = await Category.create(payload as any);
    return { category, created: true, updated: false };
  }

  const current = {
    name: String(getCategoryAttr(existing, "name") ?? ""),
    description: String(getCategoryAttr(existing, "description") ?? ""),
    icon: getCategoryAttr(existing, "icon") ?? null,
    published: Boolean(getCategoryAttr(existing, "published")),
    parentId: (getCategoryAttr(existing, "parentId") ?? null) as number | null,
  };

  const next = {
    name: payload.name,
    description: payload.description,
    icon: payload.icon,
    published: payload.published,
    parentId: payload.parentId,
  };

  const hasChanges =
    current.name !== next.name ||
    current.description !== next.description ||
    current.icon !== next.icon ||
    current.published !== next.published ||
    (current.parentId ?? null) !== (next.parentId ?? null);

  if (hasChanges) {
    await existing.update(next as any);
  }

  return { category: existing, created: false, updated: hasChanges };
}

async function seedCategoriesDemo() {
  await sequelize.authenticate();
  await syncDb();

  let parentCreated = 0;
  let parentUpdated = 0;
  let childCreated = 0;
  let childUpdated = 0;

  const parentMap = new Map<string, Category>();

  for (const parentSeed of DEMO_CATEGORY_TREE) {
    const result = await upsertCategoryByCode(parentSeed, null);
    parentMap.set(parentSeed.code, result.category);
    if (result.created) parentCreated += 1;
    if (result.updated) parentUpdated += 1;
  }

  for (const parentSeed of DEMO_CATEGORY_TREE) {
    const children = parentSeed.children ?? [];
    if (!children.length) continue;

    const parent = parentMap.get(parentSeed.code);
    if (!parent) continue;
    const parentId = getCategoryId(parent);

    for (const childSeed of children) {
      const result = await upsertCategoryByCode(childSeed, parentId);
      if (result.created) childCreated += 1;
      if (result.updated) childUpdated += 1;
    }
  }

  console.log("[seed:categories-demo] Parent categories created:", parentCreated);
  console.log("[seed:categories-demo] Parent categories updated:", parentUpdated);
  console.log("[seed:categories-demo] Sub categories created:", childCreated);
  console.log("[seed:categories-demo] Sub categories updated:", childUpdated);
}

seedCategoriesDemo()
  .catch((error) => {
    console.error("[seed:categories-demo] Failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
