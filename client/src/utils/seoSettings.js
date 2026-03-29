const toText = (value, fallback = "") => {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
};

const isAbsoluteHttpUrl = (value) => /^https?:\/\//i.test(String(value || "").trim());

export const normalizeSeoSettings = (raw) => {
  const source = raw && typeof raw === "object" ? raw : {};
  return {
    faviconDataUrl: toText(
      source.faviconDataUrl ?? source.favicon ?? source.faviconImage,
      ""
    ),
    metaTitle: toText(source.metaTitle, ""),
    metaDescription: toText(source.metaDescription, ""),
    metaUrl: toText(source.metaUrl, ""),
    metaKeywords: toText(source.metaKeywords, ""),
    metaImageDataUrl: toText(
      source.metaImageDataUrl ?? source.metaImage ?? source.image,
      ""
    ),
  };
};

export const resolveSeoAbsoluteUrl = (value, fallback) => {
  const candidate = String(value || "").trim();
  const base = String(fallback || "").trim();
  const safeBase =
    base ||
    (typeof window !== "undefined" ? window.location.href : "http://localhost/");

  if (!candidate) {
    try {
      return new URL(safeBase).toString();
    } catch {
      return "";
    }
  }

  try {
    if (isAbsoluteHttpUrl(candidate)) {
      return new URL(candidate).toString();
    }
    return new URL(candidate, safeBase).toString();
  } catch {
    try {
      return new URL(safeBase).toString();
    } catch {
      return "";
    }
  }
};
