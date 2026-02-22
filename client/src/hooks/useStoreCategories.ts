import { useQuery } from "@tanstack/react-query";
import { fetchStoreCategories } from "../api/store.service.ts";

export const STORE_CATEGORIES_QUERY_KEY = ["storeCategories"];

const toStringSafe = (value: any) => String(value ?? "").trim();
const toFirstNonEmptyString = (...values: any[]) => {
  for (const value of values) {
    const normalized = toStringSafe(value);
    if (normalized) return normalized;
  }
  return "";
};
const toNormalizedParentId = (value: any) => {
  const normalized = toStringSafe(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : normalized;
};
const toPublishedValue = (value: any, fallback = true) => {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value > 0;
  const normalized = toStringSafe(value).toLowerCase();
  if (!normalized) return fallback;
  if (["true", "1", "yes", "published", "active"].includes(normalized)) return true;
  if (["false", "0", "no", "draft", "inactive"].includes(normalized)) return false;
  return fallback;
};
const toSlug = (value: any) =>
  toStringSafe(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeStoreCategories = (payload: any) => {
  const root = payload?.data ?? payload;
  const rawItems = Array.isArray(root?.data)
    ? root.data
    : Array.isArray(root?.categories)
      ? root.categories
      : Array.isArray(root?.items)
        ? root.items
        : Array.isArray(payload?.categories)
          ? payload.categories
          : Array.isArray(payload?.items)
            ? payload.items
            : Array.isArray(root)
              ? root
              : Array.isArray(payload)
                ? payload
                : [];

  return rawItems
    .map((category: any, index: number) => {
      const rawId = category?.id ?? category?._id ?? null;
      const code = toFirstNonEmptyString(
        category?.code,
        category?.slug,
        rawId
      );
      const name = toFirstNonEmptyString(
        category?.name,
        category?.title,
        category?.label,
        category?.categoryName,
        category?.category?.name,
        code
      );
      if (!name) return null;

      const id = rawId ?? code ?? `category-${index + 1}`;
      const slug = toFirstNonEmptyString(category?.slug, category?.code, toSlug(name), id);
      const image = toFirstNonEmptyString(
        category?.image,
        category?.imageUrl,
        category?.icon,
        category?.iconUrl
      );
      const icon = toFirstNonEmptyString(category?.icon, category?.iconEmoji);
      const parentId = toNormalizedParentId(
        category?.parentId ?? category?.parent_id ?? category?.parent?.id
      );

      return {
        ...category,
        id,
        code: code || slug,
        slug: slug || code,
        name,
        description: toFirstNonEmptyString(category?.description, category?.desc) || "-",
        published: toPublishedValue(category?.published ?? category?.status, true),
        parentId,
        parent_id: parentId,
        image: image || null,
        icon: icon || null,
      };
    })
    .filter(Boolean);
};

export function useStoreCategories() {
  const query = useQuery({
    queryKey: STORE_CATEGORIES_QUERY_KEY,
    queryFn: async () => {
      const response = await fetchStoreCategories();
      return normalizeStoreCategories(response);
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    data: Array.isArray(query.data) ? query.data : [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
