type AnyCategory = Record<string, any>;

export type CategoryTreeNode = {
  id: string | number;
  name: string;
  slug: string;
  code?: string | null;
  icon?: string | null;
  image?: string | null;
  children?: CategoryTreeNode[];
};

const toStringSafe = (value: any) => String(value ?? "").trim();

const toSlug = (value: any) =>
  toStringSafe(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const resolveNodeName = (category: AnyCategory, fallback: string) =>
  toStringSafe(
    category?.name ||
      category?.title ||
      category?.label ||
      category?.categoryName ||
      category?.code ||
      category?.slug ||
      fallback
  ) || fallback;

const resolveNodeKey = (category: AnyCategory, fallback: string) => {
  const rawKey = toStringSafe(
    category?.code || category?.slug || category?.id || category?._id || fallback
  );
  if (rawKey) return rawKey;
  return toSlug(resolveNodeName(category, fallback)) || fallback;
};

const isImageLike = (value: string) =>
  value.startsWith("/") ||
  value.startsWith("./") ||
  value.startsWith("../") ||
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("data:image/") ||
  /\/.+\./.test(value) ||
  /\.(png|jpe?g|webp|svg|gif|avif)(\?|$)/i.test(value);

const normalizeNode = (category: AnyCategory, fallbackId: string): CategoryTreeNode => {
  const name = resolveNodeName(category, fallbackId);
  const key = resolveNodeKey(category, fallbackId);
  const id = category?.id ?? category?._id ?? key ?? fallbackId;
  const rawImage = toStringSafe(category?.image || category?.imageUrl || category?.icon);
  const rawIcon = toStringSafe(category?.iconEmoji || category?.icon);
  const code = toStringSafe(category?.code || category?.slug || "");

  return {
    id,
    name,
    slug: key,
    code: code || null,
    image: rawImage && isImageLike(rawImage) ? rawImage : null,
    icon: rawIcon && !isImageLike(rawIcon) ? rawIcon : null,
    children: undefined,
  };
};

const hasChildrenField = (categories: AnyCategory[]) =>
  categories.some(
    (item) =>
      Array.isArray(item?.children) ||
      Array.isArray(item?.subCategories) ||
      Array.isArray(item?.subcategories)
  );

const hasParentField = (categories: AnyCategory[]) =>
  categories.some((item) => item?.parentId != null || item?.parent_id != null);

const buildFromNested = (categories: AnyCategory[], prefix = "node"): CategoryTreeNode[] =>
  categories.map((item, index) => {
    const node = normalizeNode(item, `${prefix}-${index}`);
    const childrenRaw = item?.children || item?.subCategories || item?.subcategories || [];
    if (Array.isArray(childrenRaw) && childrenRaw.length > 0) {
      node.children = buildFromNested(childrenRaw, `${prefix}-${index}`);
    }
    return node;
  });

const buildFromParentRelation = (categories: AnyCategory[]): CategoryTreeNode[] => {
  const allNodes = categories.map((item, index) => ({
    ...normalizeNode(item, `flat-${index}`),
    __parentId: item?.parentId ?? item?.parent_id ?? null,
  })) as Array<CategoryTreeNode & { __parentId: any }>;

  const byId = new Map<string, CategoryTreeNode & { __parentId: any }>();
  allNodes.forEach((node) => byId.set(toStringSafe(node.id), node));

  const roots: Array<CategoryTreeNode & { __parentId: any }> = [];
  allNodes.forEach((node) => {
    const parentKey = toStringSafe(node.__parentId);
    if (!parentKey) {
      roots.push(node);
      return;
    }
    const parent = byId.get(parentKey);
    if (!parent) {
      roots.push(node);
      return;
    }
    parent.children = parent.children || [];
    parent.children.push(node);
  });

  const stripMeta = (nodes: Array<CategoryTreeNode & { __parentId: any }>): CategoryTreeNode[] =>
    nodes.map((node) => ({
      id: node.id,
      slug: node.slug,
      code: node.code,
      name: node.name,
      icon: node.icon,
      image: node.image,
      children: node.children ? stripMeta(node.children as any) : undefined,
    }));

  return stripMeta(roots);
};

const buildFlatList = (categories: AnyCategory[]): CategoryTreeNode[] =>
  categories.map((item, index) => normalizeNode(item, `category-${index}`));

export function buildCategoryTree(categories: AnyCategory[]): CategoryTreeNode[] {
  if (!Array.isArray(categories) || categories.length === 0) return [];
  if (hasChildrenField(categories)) return buildFromNested(categories);
  if (hasParentField(categories)) return buildFromParentRelation(categories);
  return buildFlatList(categories);
}
