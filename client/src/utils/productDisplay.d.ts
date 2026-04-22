export function normalizeProductDisplayTags(
  raw: unknown,
  options?: {
    filterInternal?: boolean;
    maxLength?: number;
  }
): string[];

export function getProductVisibleImageUrls(productLike: unknown): string[];

export function getPrimaryProductImageUrl(productLike: unknown, fallback?: string): string;
