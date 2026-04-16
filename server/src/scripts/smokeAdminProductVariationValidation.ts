import "dotenv/config";
import assert from "node:assert/strict";
import { Product } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const RUN_ID = `mvf-variation-validation-${Date.now()}`;

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
};

type AttributeRecord = {
  id: number;
  name: string;
  displayName?: string | null;
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
    };
  }
}

const createdProductIds: number[] = [];

const logStep = (label: string) => {
  console.log(`[mvf-variation-validation] ${label}`);
};

const logPass = (label: string) => {
  console.log(`[mvf-variation-validation] PASS ${label}`);
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
  assert.equal(
    response.ok,
    true,
    `[mvf-variation-validation] API not ready at ${BASE_URL}/api/health`
  );
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

async function ensureAttribute(
  client: CookieClient,
  name: string,
  values: string[]
): Promise<{ attribute: AttributeRecord; values: AttributeValueRecord[] }> {
  const listResponse = await client.request("/api/admin/attributes");
  assertStatus(listResponse, 200, `list attributes for ${name}`);
  const list = Array.isArray(listResponse.body?.data) ? listResponse.body.data : [];
  let attribute = list.find(
    (entry: any) => String(entry?.name || "").trim() === name
  ) as AttributeRecord | undefined;

  if (!attribute) {
    const createResponse = await client.request("/api/admin/attributes", {
      method: "POST",
      body: JSON.stringify({
        name,
        displayName: name,
      }),
    });
    assertStatus(createResponse, 200, `create attribute ${name}`);
    attribute = createResponse.body?.data as AttributeRecord;
  }

  const valueResponse = await client.request(`/api/admin/attributes/${attribute.id}/values`);
  assertStatus(valueResponse, 200, `list values for ${name}`);
  const existingValues = Array.isArray(valueResponse.body?.data) ? valueResponse.body.data : [];

  for (const value of values) {
    const exists = existingValues.some(
      (entry: any) => String(entry?.value || "").trim() === value
    );
    if (!exists) {
      const createValueResponse = await client.request(
        `/api/admin/attributes/${attribute.id}/values`,
        {
          method: "POST",
          body: JSON.stringify({ value }),
        }
      );
      assertStatus(createValueResponse, 200, `create value ${value} for ${name}`);
      existingValues.push(createValueResponse.body?.data);
    }
  }

  const refreshedValues = await client.request(`/api/admin/attributes/${attribute.id}/values`);
  assertStatus(refreshedValues, 200, `refresh values for ${name}`);
  return {
    attribute,
    values: Array.isArray(refreshedValues.body?.data) ? refreshedValues.body.data : [],
  };
}

const buildSelections = (
  input: Array<{
    attribute: AttributeRecord;
    value: AttributeValueRecord;
  }>
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

const buildSelectedAttributeValues = (
  input: Array<{
    attribute: AttributeRecord;
    values: AttributeValueRecord[];
  }>
) =>
  input.map(({ attribute, values }) => ({
    attributeId: Number(attribute.id),
    values: values.map((value) => ({
      id: Number(value.id),
      label: String(value.value || "").trim(),
      value: String(value.value || "").trim(),
    })),
  }));

async function createFixtureProduct(client: CookieClient, categoryId: number) {
  const response = await client.request("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID}-base-product`,
      description: "Variation validation smoke product",
      price: 120,
      stock: 10,
      categoryId,
      categoryIds: [categoryId],
      defaultCategoryId: categoryId,
      published: true,
      status: "active",
      variations: null,
    }),
  });
  assertStatus(response, 201, "create fixture product");
  const id = Number(response.body?.data?.id);
  createdProductIds.push(id);
  return id;
}

async function expectInvalid(
  client: CookieClient,
  productId: number,
  label: string,
  variations: any,
  expectedMessageFragment: string
) {
  const response = await client.request(`/api/admin/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({ variations }),
  });
  assertStatus(response, 400, label);
  const message = String(response.body?.message || "");
  assert.ok(
    message.includes(expectedMessageFragment),
    `${label}: expected message to include "${expectedMessageFragment}", received "${message}"`
  );
  logPass(label);
}

async function cleanup() {
  if (!createdProductIds.length) return;
  await Product.destroy({
    where: { id: createdProductIds } as any,
    force: true,
  } as any);
}

async function main() {
  await ensureServerReady();
  const client = new CookieClient();
  await loginAdmin(client);

  const defaultCategoryId = await getDefaultCategoryId(client);
  const color = await ensureAttribute(client, "QA Validation Color", ["Blue", "Green", "Red"]);
  const size = await ensureAttribute(client, "QA Validation Size", ["M", "L"]);

  const productId = await createFixtureProduct(client, defaultCategoryId);

  const blue = color.values.find((entry) => String(entry.value) === "Blue")!;
  const green = color.values.find((entry) => String(entry.value) === "Green")!;
  const red = color.values.find((entry) => String(entry.value) === "Red")!;
  const sizeM = size.values.find((entry) => String(entry.value) === "M")!;
  const sizeL = size.values.find((entry) => String(entry.value) === "L")!;

  logStep("verify valid create/update payloads");
  const oneAttributeSelections = buildSelections([
    { attribute: color.attribute, value: blue },
    { attribute: color.attribute, value: green },
  ]);

  const validCreate = await client.request("/api/admin/products", {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID}-valid-create`,
      description: "Valid combination create",
      price: 120,
      stock: 8,
      categoryId: defaultCategoryId,
      categoryIds: [defaultCategoryId],
      defaultCategoryId,
      published: true,
      status: "active",
      variations: {
        hasVariants: true,
        selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
        selectedAttributeValues: buildSelectedAttributeValues([
          { attribute: color.attribute, values: [blue, green] },
        ]),
        variants: [
          {
            id: "valid-blue",
            combination: buildCombination(oneAttributeSelections.slice(0, 1)),
            combinationKey: buildCombinationKey(oneAttributeSelections.slice(0, 1)),
            selections: oneAttributeSelections.slice(0, 1),
            sku: "VALID-BLUE",
            barcode: "VALID-BLUE",
            price: 120,
            salePrice: 100,
            quantity: 2,
            image: null,
          },
          {
            id: "valid-green",
            combination: buildCombination(oneAttributeSelections.slice(1, 2)),
            combinationKey: buildCombinationKey(oneAttributeSelections.slice(1, 2)),
            selections: oneAttributeSelections.slice(1, 2),
            sku: "VALID-GREEN",
            barcode: "VALID-GREEN",
            price: 125,
            salePrice: 105,
            quantity: 3,
            image: null,
          },
        ],
      },
    }),
  });
  assertStatus(validCreate, 201, "valid create with one attribute");
  createdProductIds.push(Number(validCreate.body?.data?.id));
  logPass("valid create with one attribute");

  const blueMSelections = buildSelections([
    { attribute: color.attribute, value: blue },
    { attribute: size.attribute, value: sizeM },
  ]);
  const blueLSelections = buildSelections([
    { attribute: color.attribute, value: blue },
    { attribute: size.attribute, value: sizeL },
  ]);

  const validUpdate = await client.request(`/api/admin/products/${productId}`, {
    method: "PATCH",
    body: JSON.stringify({
      variations: {
        hasVariants: true,
        selectedAttributes: [
          { id: color.attribute.id, name: color.attribute.name },
          { id: size.attribute.id, name: size.attribute.name },
        ],
        selectedAttributeValues: buildSelectedAttributeValues([
          { attribute: color.attribute, values: [blue, green] },
          { attribute: size.attribute, values: [sizeM, sizeL] },
        ]),
        variants: [
          {
            id: "blue-m",
            combination: buildCombination(blueMSelections),
            combinationKey: buildCombinationKey(blueMSelections),
            selections: blueMSelections,
            sku: "BLUE-M",
            barcode: "BLUE-M",
            price: 130,
            salePrice: 120,
            quantity: 4,
            image: null,
          },
          {
            id: "blue-l",
            combination: buildCombination(blueLSelections),
            combinationKey: buildCombinationKey(blueLSelections),
            selections: blueLSelections,
            sku: "BLUE-L",
            barcode: "BLUE-L",
            price: 135,
            salePrice: 125,
            quantity: 5,
            image: null,
          },
        ],
      },
    }),
  });
  assertStatus(validUpdate, 200, "valid update with two attributes");
  logPass("valid update with two attributes");

  logStep("verify invalid payloads are rejected");
  await expectInvalid(
    client,
    productId,
    "reject unknown attribute id",
    {
      hasVariants: true,
      selectedAttributes: [{ id: 999999, name: "Ghost" }],
      selectedAttributeValues: [],
      variants: [],
    },
    "unknown attribute ids"
  );

  await expectInvalid(
    client,
    productId,
    "reject unknown value id",
    {
      hasVariants: true,
      selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
      selectedAttributeValues: [
        {
          attributeId: color.attribute.id,
          values: [{ id: 999999, label: "Ghost", value: "Ghost" }],
        },
      ],
      variants: [],
    },
    "unknown value id"
  );

  await expectInvalid(
    client,
    productId,
    "reject value ownership mismatch",
    {
      hasVariants: true,
      selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
      selectedAttributeValues: [
        {
          attributeId: color.attribute.id,
          values: [{ id: sizeM.id, label: sizeM.value, value: sizeM.value }],
        },
      ],
      variants: [],
    },
    "does not belong to attribute"
  );

  await expectInvalid(
    client,
    productId,
    "reject duplicate selected attribute",
    {
      hasVariants: true,
      selectedAttributes: [
        { id: color.attribute.id, name: color.attribute.name },
        { id: color.attribute.id, name: color.attribute.name },
      ],
      selectedAttributeValues: [],
      variants: [],
    },
    "duplicate attribute id"
  );

  await expectInvalid(
    client,
    productId,
    "reject duplicate selected value",
    {
      hasVariants: true,
      selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
      selectedAttributeValues: [
        {
          attributeId: color.attribute.id,
          values: [
            { id: blue.id, label: blue.value, value: blue.value },
            { id: blue.id, label: blue.value, value: blue.value },
          ],
        },
      ],
      variants: [
        {
          id: "dup-blue",
          combination: buildCombination(buildSelections([{ attribute: color.attribute, value: blue }])),
          combinationKey: buildCombinationKey(buildSelections([{ attribute: color.attribute, value: blue }])),
          selections: buildSelections([{ attribute: color.attribute, value: blue }]),
          price: 120,
          salePrice: 100,
          quantity: 1,
        },
      ],
    },
    "duplicate value"
  );

  const duplicateSelections = buildSelections([
    { attribute: color.attribute, value: blue },
    { attribute: size.attribute, value: sizeM },
  ]);
  await expectInvalid(
    client,
    productId,
    "reject duplicate variant combination",
    {
      hasVariants: true,
      selectedAttributes: [
        { id: color.attribute.id, name: color.attribute.name },
        { id: size.attribute.id, name: size.attribute.name },
      ],
      selectedAttributeValues: buildSelectedAttributeValues([
        { attribute: color.attribute, values: [blue, green] },
        { attribute: size.attribute, values: [sizeM, sizeL] },
      ]),
      variants: [
        {
          id: "dup-1",
          combination: buildCombination(duplicateSelections),
          combinationKey: buildCombinationKey(duplicateSelections),
          selections: duplicateSelections,
          price: 120,
          salePrice: 100,
          quantity: 1,
        },
        {
          id: "dup-2",
          combination: buildCombination(duplicateSelections),
          combinationKey: buildCombinationKey(duplicateSelections),
          selections: duplicateSelections,
          price: 120,
          salePrice: 100,
          quantity: 1,
        },
      ],
    },
    "Duplicate variation combination"
  );

  await expectInvalid(
    client,
    productId,
    "reject selection outside selected values",
    {
      hasVariants: true,
      selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
      selectedAttributeValues: buildSelectedAttributeValues([
        { attribute: color.attribute, values: [blue, green] },
      ]),
      variants: [
        {
          id: "red-only",
          combination: buildCombination(buildSelections([{ attribute: color.attribute, value: red }])),
          combinationKey: buildCombinationKey(buildSelections([{ attribute: color.attribute, value: red }])),
          selections: buildSelections([{ attribute: color.attribute, value: red }]),
          price: 120,
          salePrice: 100,
          quantity: 1,
        },
      ],
    },
    "outside the selected values"
  );

  await expectInvalid(
    client,
    productId,
    "reject incomplete combination payload",
    {
      hasVariants: true,
      selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
      selectedAttributeValues: [],
      variants: [],
    },
    "must contain at least one entry"
  );

  await expectInvalid(
    client,
    productId,
    "reject mismatched combination key",
    {
      hasVariants: true,
      selectedAttributes: [{ id: color.attribute.id, name: color.attribute.name }],
      selectedAttributeValues: buildSelectedAttributeValues([
        { attribute: color.attribute, values: [blue, green] },
      ]),
      variants: [
        {
          id: "wrong-key",
          combination: "Blue",
          combinationKey: "wrong-key",
          selections: buildSelections([{ attribute: color.attribute, value: blue }]),
          price: 120,
          salePrice: 100,
          quantity: 1,
        },
      ],
    },
    "combinationKey does not match"
  );

  console.log("[mvf-variation-validation] DONE");
}

main()
  .catch((error) => {
    console.error("[mvf-variation-validation] FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
  });
