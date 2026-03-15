const INTERNAL_TAG_PATTERN = /^(source:|__)|seed:/i;

const tryParseJson = (value) => {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false, value: null };
  }
};

const normalizeText = (value) => String(value || "").trim();

const truncateText = (value, maxLength) => {
  if (!Number.isFinite(maxLength) || maxLength <= 0) return value;
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
};

export const normalizeProductDisplayTags = (
  raw,
  options = {}
) => {
  const { filterInternal = false, maxLength = Number.POSITIVE_INFINITY } = options;
  const result = [];
  const seen = new Set();

  const pushTag = (candidate) => {
    const text = normalizeText(candidate);
    if (!text) return;
    if (filterInternal && INTERNAL_TAG_PATTERN.test(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(truncateText(text, maxLength));
  };

  const consume = (entry, depth = 0) => {
    if (entry == null || depth > 4) return;

    if (Array.isArray(entry)) {
      entry.forEach((item) => consume(item, depth + 1));
      return;
    }

    if (typeof entry === "string") {
      let normalized = normalizeText(entry);
      if (!normalized) return;

      const parsed = tryParseJson(normalized);
      if (parsed.ok) {
        consume(parsed.value, depth + 1);
        return;
      }

      const unescaped = normalized
        .replace(/\\"/g, '"')
        .replace(/\\'/g, "'")
        .replace(/\\\\/g, "\\")
        .trim();
      if (unescaped && unescaped !== normalized) {
        const reparsed = tryParseJson(unescaped);
        if (reparsed.ok) {
          consume(reparsed.value, depth + 1);
          return;
        }
        normalized = unescaped;
      }

      if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
      ) {
        const stripped = normalized.slice(1, -1).trim();
        if (stripped && stripped !== normalized) {
          consume(stripped, depth + 1);
          return;
        }
      }

      if (normalized.includes(",")) {
        normalized
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean)
          .forEach((part) => pushTag(part));
        return;
      }

      pushTag(normalized);
      return;
    }

    if (typeof entry === "object") {
      const unitValue = entry.unit ?? entry.Unit;
      if (unitValue != null) pushTag(unitValue);

      Object.entries(entry).forEach(([key, value]) => {
        if (["unit", "Unit", "source", "Source"].includes(key)) return;
        if (/^(seed|__)/i.test(key)) return;
        if (value != null && typeof value !== "object") pushTag(value);
      });
      return;
    }

    pushTag(entry);
  };

  consume(raw);
  return result;
};

export const getProductVisibleImageUrls = (productLike) => {
  const primaryCandidates = [
    productLike?.imageUrl,
    productLike?.promoImageUrl,
    productLike?.promoImagePath,
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const galleryCandidates = [
    ...(Array.isArray(productLike?.imageUrls) ? productLike.imageUrls : []),
    ...(Array.isArray(productLike?.imagePaths) ? productLike.imagePaths : []),
  ]
    .map((value) => normalizeText(value))
    .filter(Boolean);

  return Array.from(new Set([...primaryCandidates, ...galleryCandidates]));
};

export const getPrimaryProductImageUrl = (productLike, fallback = "") =>
  getProductVisibleImageUrls(productLike)[0] || fallback;
