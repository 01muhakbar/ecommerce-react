const isAbsoluteUrl = (value) => {
  const text = String(value || "").trim().toLowerCase();
  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("data:") ||
    text.startsWith("blob:")
  );
};

const ensureLeadingSlash = (value) => {
  if (!value) return "";
  return value.startsWith("/") ? value : `/${value}`;
};

const normalizeUploadsPath = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (isAbsoluteUrl(raw)) return raw;
  if (raw.startsWith("/uploads/")) return raw;
  if (raw.startsWith("uploads/")) return ensureLeadingSlash(raw);
  if (raw.startsWith("/")) return raw;
  return `/uploads/${raw}`;
};

export const resolveProductImageUrl = (product) => {
  if (!product) return "";
  const candidates = [
    product.imageUrl,
    product.image,
    product.thumbnail,
    product.photo,
    product.url,
  ];
  for (const candidate of candidates) {
    if (candidate) return normalizeUploadsPath(candidate);
  }
  const promo = product.promoImagePath ?? product.promo_image_path;
  if (promo) return normalizeUploadsPath(promo);
  const paths =
    product.imagePaths ?? product.images ?? product.image_paths ?? null;
  if (Array.isArray(paths) && paths.length > 0) {
    return normalizeUploadsPath(paths[0]);
  }
  return "";
};

export const ensureProductImageUrl = (value) => normalizeUploadsPath(value);
