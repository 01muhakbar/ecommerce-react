import "dotenv/config";
import assert from "node:assert/strict";
import { Product } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const RUN_ID = `mvf-attribute-domain-${Date.now()}`;

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
  headers: Headers;
};

type AttributeRecord = {
  id: number;
  name: string;
  displayName?: string | null;
  type?: string;
  published?: boolean;
  values?: string[];
};

type AttributeValueRecord = {
  id: number;
  attributeId?: number;
  value: string;
};

class CookieClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) {
      headers.set("Cookie", this.cookie);
    }

    const response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
    });

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0] || this.cookie;
    }

    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return {
      status: response.status,
      ok: response.ok,
      body,
      text,
      headers: response.headers,
    };
  }
}

const createdProductIds: number[] = [];
const createdAttributeIds = new Set<number>();

const log = (label: string) => {
  console.log(`[mvf-attribute-domain] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-attribute-domain] PASS ${label}`);
};

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, `[mvf-attribute-domain] API not ready at ${BASE_URL}/api/health`);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  assertStatus(response, 200, "admin login");
  logPass("admin login");
}

async function getDefaultCategoryId(client: CookieClient) {
  const response = await client.request("/api/admin/categories?page=1&limit=50");
  assertStatus(response, 200, "fetch categories");
  const categories = Array.isArray(response.body?.data) ? response.body.data : [];
  assert.ok(categories.length > 0, "expected at least one category for smoke validation");
  return Number(categories[0].id);
}

async function fetchAttributeValues(client: CookieClient, attributeId: number) {
  const response = await client.request(`/api/admin/attributes/${attributeId}/values`);
  assertStatus(response, 200, `fetch values for attribute ${attributeId}`);
  return Array.isArray(response.body?.data) ? (response.body.data as AttributeValueRecord[]) : [];
}

const buildSelections = (
  input: Array<{ attribute: AttributeRecord; value: AttributeValueRecord }>
) =>
  input.map(({ attribute, value }) => ({
    attributeId: Number(attribute.id),
    attributeName: String(attribute.displayName || attribute.name || "").trim(),
    valueId: Number(value.id),
    value: String(value.value || "").trim(),
  }));

const buildCombination = (selections: Array<{ value: string }>) =>
  selections.map((entry) => entry.value).join(" / ");

const buildCombinationKey = (
  selections: Array<{ attributeId: number; valueId: number; value: string }>
) =>
  selections
    .map((entry) => `${entry.attributeId}:${String(entry.valueId ?? entry.value).trim().toLowerCase()}`)
    .join("|");

async function createFixtureProduct(
  client: CookieClient,
  categoryId: number,
  attribute: AttributeRecord,
  values: AttributeValueRecord[]
) {
  const firstValue = values[0];
  const secondValue = values[1] || values[0];
  const selectionOne = buildSelections([{ attribute, value: firstValue }]);
  const selectionTwo = buildSelections([{ attribute, value: secondValue }]);

  const response = await client.request("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID}-fixture-product`,
      description: "Attribute domain smoke product",
      price: 120,
      stock: 10,
      categoryId,
      categoryIds: [categoryId],
      defaultCategoryId: categoryId,
      published: true,
      status: "active",
      variations: {
        hasVariants: true,
        selectedAttributes: [{ id: attribute.id, name: attribute.name }],
        selectedAttributeValues: [
          {
            attributeId: attribute.id,
            values: values.slice(0, 2).map((value) => ({
              id: Number(value.id),
              label: String(value.value || "").trim(),
              value: String(value.value || "").trim(),
            })),
          },
        ],
        variants: [
          {
            id: "variant-1",
            combination: buildCombination(selectionOne),
            combinationKey: buildCombinationKey(selectionOne),
            selections: selectionOne,
            sku: "ATTR-1",
            barcode: "ATTR-1",
            price: 120,
            salePrice: 100,
            quantity: 3,
            image: null,
          },
          {
            id: "variant-2",
            combination: buildCombination(selectionTwo),
            combinationKey: buildCombinationKey(selectionTwo),
            selections: selectionTwo,
            sku: "ATTR-2",
            barcode: "ATTR-2",
            price: 130,
            salePrice: 110,
            quantity: 4,
            image: null,
          },
        ],
      },
    }),
  });

  assertStatus(response, 201, "create fixture product");
  const productId = Number(response.body?.data?.id);
  createdProductIds.push(productId);
  return productId;
}

async function cleanup() {
  if (createdProductIds.length > 0) {
    await Product.destroy({
      where: { id: createdProductIds } as any,
      force: true,
    } as any);
  }

  const cleanupClient = new CookieClient();
  try {
    await loginAdmin(cleanupClient);
    for (const attributeId of createdAttributeIds) {
      await cleanupClient.request(`/api/admin/attributes/${attributeId}`, {
        method: "DELETE",
      });
    }
  } catch {
    // best-effort cleanup only
  }
}

async function main() {
  await ensureServerReady();
  const client = new CookieClient();
  await loginAdmin(client);
  const defaultCategoryId = await getDefaultCategoryId(client);

  log("create attribute with metadata and values");
  const createResponse = await client.request("/api/admin/attributes", {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID}-material`,
      displayName: "Material",
      type: "checkbox",
      published: false,
      values: ["Cotton", "Linen"],
    }),
  });
  assertStatus(createResponse, 200, "create attribute");
  const createdAttribute = createResponse.body?.data as AttributeRecord;
  assert.equal(createdAttribute.type, "checkbox");
  assert.equal(createdAttribute.published, false);
  assert.deepEqual(createdAttribute.values, ["Cotton", "Linen"]);
  createdAttributeIds.add(Number(createdAttribute.id));
  logPass("create attribute");

  log("verify list filters and search");
  const listResponse = await client.request(
    `/api/admin/attributes?q=${encodeURIComponent(RUN_ID)}&type=checkbox&published=false&page=1&limit=20`
  );
  assertStatus(listResponse, 200, "list attributes with filters");
  const listItems = Array.isArray(listResponse.body?.data) ? listResponse.body.data : [];
  assert.ok(listItems.some((entry: any) => Number(entry.id) === Number(createdAttribute.id)));
  logPass("list filters");

  log("patch published and values");
  const patchResponse = await client.request(`/api/admin/attributes/${createdAttribute.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      published: true,
      values: ["Cotton", "Linen", "Silk"],
    }),
  });
  assertStatus(patchResponse, 200, "patch attribute");
  assert.equal(Boolean(patchResponse.body?.data?.published), true);
  assert.equal(Number(patchResponse.body?.data?.valueCount), 3);
  logPass("patch attribute");

  log("patch attribute value");
  const patchedValues = await fetchAttributeValues(client, Number(createdAttribute.id));
  const editableValue = patchedValues.find((entry) => entry.value === "Silk") || patchedValues[0];
  assert.ok(editableValue?.id, "expected at least one editable attribute value");
  const patchValueResponse = await client.request(`/api/admin/attribute-values/${editableValue.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      value: "Silk Premium",
    }),
  });
  assertStatus(patchValueResponse, 200, "patch attribute value");
  assert.equal(String(patchValueResponse.body?.data?.value || ""), "Silk Premium");
  logPass("patch attribute value");

  log("verify bulk delete attribute values");
  const bulkDeleteSource = await client.request(`/api/admin/attributes/${createdAttribute.id}/values`, {
    method: "POST",
    body: JSON.stringify({ value: "Rayon" }),
  });
  assertStatus(bulkDeleteSource, 200, "create bulk delete value one");
  const bulkDeleteSourceTwo = await client.request(`/api/admin/attributes/${createdAttribute.id}/values`, {
    method: "POST",
    body: JSON.stringify({ value: "Viscose" }),
  });
  assertStatus(bulkDeleteSourceTwo, 200, "create bulk delete value two");
  const bulkDeleteValuesResponse = await client.request("/api/admin/attribute-values/bulk-delete", {
    method: "POST",
    body: JSON.stringify({
      ids: [bulkDeleteSource.body?.data?.id, bulkDeleteSourceTwo.body?.data?.id],
    }),
  });
  assertStatus(bulkDeleteValuesResponse, 200, "bulk delete attribute values");
  assert.equal(Number(bulkDeleteValuesResponse.body?.affected || 0), 2);
  logPass("bulk delete attribute values");

  log("verify bulk publish/unpublish");
  const bulkUnpublish = await client.request("/api/admin/attributes/bulk", {
    method: "POST",
    body: JSON.stringify({
      action: "unpublish",
      ids: [createdAttribute.id],
    }),
  });
  assertStatus(bulkUnpublish, 200, "bulk unpublish");
  const bulkPublish = await client.request("/api/admin/attributes/bulk", {
    method: "POST",
    body: JSON.stringify({
      action: "publish",
      ids: [createdAttribute.id],
    }),
  });
  assertStatus(bulkPublish, 200, "bulk publish");
  logPass("bulk publish/unpublish");

  log("verify export endpoints");
  const exportJson = await client.request("/api/admin/attributes/export?type=json");
  assertStatus(exportJson, 200, "export attributes json");
  assert.ok(String(exportJson.headers.get("content-type") || "").includes("application/json"));
  const exportCsv = await client.request("/api/admin/attributes/export?type=csv");
  assertStatus(exportCsv, 200, "export attributes csv");
  assert.ok(String(exportCsv.headers.get("content-type") || "").includes("text/csv"));
  logPass("export endpoints");

  log("verify import endpoint");
  const importResponse = await client.request("/api/admin/attributes/import", {
    method: "POST",
    body: JSON.stringify([
      {
        name: `${RUN_ID}-size`,
        displayName: "Size",
        type: "radio",
        published: true,
        values: ["S", "M", "L"],
      },
    ]),
  });
  assertStatus(importResponse, 200, "import attributes");
  assert.equal(Number(importResponse.body?.data?.created || 0), 1);
  logPass("import endpoint");

  const importedListResponse = await client.request(`/api/admin/attributes?q=${encodeURIComponent(`${RUN_ID}-size`)}`);
  assertStatus(importedListResponse, 200, "list imported attribute");
  const importedAttribute = (Array.isArray(importedListResponse.body?.data)
    ? importedListResponse.body.data[0]
    : null) as AttributeRecord | null;
  assert.ok(importedAttribute?.id, "expected imported attribute to be listed");
  createdAttributeIds.add(Number(importedAttribute!.id));

  log("verify delete guards while product is using attribute/value");
  const refreshedValues = await fetchAttributeValues(client, Number(createdAttribute.id));
  assert.ok(refreshedValues.length >= 2, "expected at least two values for created attribute");
  await createFixtureProduct(client, defaultCategoryId, createdAttribute, refreshedValues);

  const deleteValueWhileUsed = await client.request(`/api/admin/attribute-values/${refreshedValues[0].id}`, {
    method: "DELETE",
  });
  assertStatus(deleteValueWhileUsed, 409, "delete attribute value while used");

  const deleteAttributeWhileUsed = await client.request(`/api/admin/attributes/${createdAttribute.id}`, {
    method: "DELETE",
  });
  assertStatus(deleteAttributeWhileUsed, 409, "delete attribute while used");

  const bulkDeleteWhileUsed = await client.request("/api/admin/attributes/bulk", {
    method: "POST",
    body: JSON.stringify({
      action: "delete",
      ids: [createdAttribute.id],
    }),
  });
  assertStatus(bulkDeleteWhileUsed, 409, "bulk delete attribute while used");
  logPass("delete guards");

  console.log("[mvf-attribute-domain] DONE");
}

main()
  .catch((error) => {
    console.error("[mvf-attribute-domain] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
