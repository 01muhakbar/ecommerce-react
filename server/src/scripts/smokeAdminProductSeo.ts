import assert from "node:assert/strict";
import {
  mergeAdminProductSeoInput,
  normalizeAdminProductSeoResponse,
  sanitizeAdminProductSeo,
} from "../routes/admin.products.js";

const logStep = (label: string) => {
  console.log(`[mvf-product-seo] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-product-seo] PASS ${label}`);
};

const expectInvalid = (label: string, value: unknown, expectedMessageFragment: string) => {
  assert.throws(
    () => sanitizeAdminProductSeo(value),
    (error: any) => {
      const message = String(error?.message || "");
      return message.includes(expectedMessageFragment);
    },
    label
  );
  logPass(label);
};

function main() {
  logStep("verify valid create-style sanitization");
  assert.equal(sanitizeAdminProductSeo(undefined), null);
  assert.equal(sanitizeAdminProductSeo(null), null);
  logPass("create without seo persists null");

  const validCreateSeo = sanitizeAdminProductSeo({
    metaTitle: "  SEO Title  ",
    metaDescription: "  SEO Description  ",
    keywords: ["Cotton", "cotton", "", "Shirt"],
    ogImageUrl: "  https://example.com/og-image.jpg  ",
  });
  assert.deepEqual(validCreateSeo, {
    metaTitle: "SEO Title",
    metaDescription: "SEO Description",
    keywords: ["Cotton", "Shirt"],
    ogImageUrl: "https://example.com/og-image.jpg",
  });
  logPass("create with valid seo sanitizes and dedupes");

  logStep("verify patch merge behavior");
  const mergedPatchInput = mergeAdminProductSeoInput(validCreateSeo, {
    metaDescription: "Updated SEO Description",
    ogImageUrl: "/uploads/seo-updated.webp",
  });
  const mergedPatchSeo = sanitizeAdminProductSeo(mergedPatchInput);
  assert.deepEqual(mergedPatchSeo, {
    metaTitle: "SEO Title",
    metaDescription: "Updated SEO Description",
    keywords: ["Cotton", "Shirt"],
    ogImageUrl: "/uploads/seo-updated.webp",
  });
  logPass("patch seo merges field-per-field");

  const clearedSeo = sanitizeAdminProductSeo(mergeAdminProductSeoInput(validCreateSeo, null));
  assert.equal(clearedSeo, null);
  logPass("patch seo null clears persisted seo");

  logStep("verify detail normalization");
  assert.deepEqual(normalizeAdminProductSeoResponse(null), {
    metaTitle: "",
    metaDescription: "",
    keywords: [],
    ogImageUrl: "",
  });
  logPass("detail without seo returns normalized empty object");

  assert.deepEqual(
    normalizeAdminProductSeoResponse({
      metaTitle: " SEO Title ",
      metaDescription: " SEO Description ",
      keywords: ["Cotton", "cotton", "Shirt", ""],
      ogImageUrl: "https://example.com/og-image.jpg",
    }),
    {
      metaTitle: "SEO Title",
      metaDescription: "SEO Description",
      keywords: ["Cotton", "Shirt"],
      ogImageUrl: "https://example.com/og-image.jpg",
    }
  );
  logPass("detail with seo returns normalized object");

  logStep("verify invalid SEO payloads are rejected");
  expectInvalid("reject seo not object or null", "invalid", "seo must be an object or null");
  expectInvalid(
    "reject keywords not array",
    { keywords: "shirt" },
    "seo.keywords must be an array of strings"
  );
  expectInvalid(
    "reject non-string keyword",
    { keywords: ["shirt", 5] },
    "seo.keywords must contain only strings"
  );
  expectInvalid(
    "reject long meta title",
    { metaTitle: "a".repeat(256) },
    "seo.metaTitle must be 255 characters or fewer"
  );
  expectInvalid(
    "reject long meta description",
    { metaDescription: "a".repeat(1001) },
    "seo.metaDescription must be 1000 characters or fewer"
  );
  expectInvalid(
    "reject invalid og image url",
    { ogImageUrl: "ftp://example.com/seo-image.png" },
    "seo.ogImageUrl must be an absolute http(s) URL or a local path starting with /"
  );
  expectInvalid(
    "reject too many keywords",
    { keywords: Array.from({ length: 31 }, (_, index) => `keyword-${index}`) },
    "seo.keywords must contain 30 entries or fewer"
  );

  console.log("[mvf-product-seo] DONE");
}

try {
  main();
} catch (error) {
  console.error("[mvf-product-seo] FAIL", error);
  process.exitCode = 1;
}
