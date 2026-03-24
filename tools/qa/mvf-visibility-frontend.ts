import assert from "node:assert/strict";
import { normalizeStorefrontProduct } from "../../client/src/utils/storefrontCatalog.ts";

const inferredFromStatus = normalizeStorefrontProduct({
  id: 1,
  name: "mvf-frontend-active-only",
  status: "active",
});

assert.ok(inferredFromStatus, "storefront normalizer should return a product payload");
assert.equal(
  inferredFromStatus?.published,
  false,
  "storefront normalizer must not infer published=true from status=active"
);
assert.equal(
  inferredFromStatus?.status,
  "active",
  "storefront normalizer should preserve lifecycle status"
);

const explicitPublished = normalizeStorefrontProduct({
  id: 2,
  name: "mvf-frontend-explicit-published",
  status: "draft",
  isPublished: true,
});

assert.ok(explicitPublished, "storefront normalizer should normalize explicit publish flag");
assert.equal(
  explicitPublished?.published,
  true,
  "storefront normalizer should honor explicit publish metadata"
);
assert.equal(
  explicitPublished?.status,
  "draft",
  "storefront normalizer should not rewrite status when publish metadata exists"
);

console.log("[mvf-visibility-frontend] OK");
