import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { Attribute, Product, Store, User, sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const ADMIN_EMAIL = process.env.MVF_ADMIN_EMAIL || "superadmin@local.dev";
const ADMIN_PASSWORD = process.env.MVF_ADMIN_PASSWORD || "supersecure123";
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-seller-attr-crud-${Date.now()}`;

type JsonResponse = {
  status: number;
  ok: boolean;
  body: any;
  text: string;
  headers: Headers;
};

class CookieClient {
  private cookie = "";

  async request(path: string, init: RequestInit = {}): Promise<JsonResponse> {
    const headers = new Headers(init.headers || {});
    headers.set("Accept", "application/json");
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (this.cookie) headers.set("Cookie", this.cookie);

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

const createdUserIds: number[] = [];
const createdStoreIds: number[] = [];
const createdAttributeIds: number[] = [];
const createdProductIds: number[] = [];

const logStep = (label: string) => console.log(`[seller-attributes-crud] ${label}`);
const logPass = (label: string) => console.log(`[seller-attributes-crud] PASS ${label}`);

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
    `[seller-attributes-crud] API not ready at ${BASE_URL}/api/health`
  );
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `Seller Attr ${label}`,
    email,
    password: hashed,
    role: "customer",
    status: "active",
  } as any);
  const id = Number(user.getDataValue("id"));
  createdUserIds.push(id);
  return { id, email, password: DEFAULT_PASSWORD };
}

async function createFixtureStore(ownerUserId: number, label: string) {
  const slug = `${RUN_ID}-${label}-store`.toLowerCase();
  const store = await Store.create({
    ownerUserId,
    name: `${RUN_ID} ${label} store`,
    slug,
    status: "ACTIVE",
  } as any);
  const id = Number(store.getDataValue("id"));
  createdStoreIds.push(id);
  return { id, slug };
}

async function createGlobalAttribute(name: string, published: boolean, values: string[]) {
  const attribute = await Attribute.create({
    name,
    displayName: `${name} display`,
    type: "dropdown",
    published,
    scope: "global",
    storeId: null,
    createdByRole: "admin",
    createdByUserId: null,
    status: "active",
  } as any);
  const attributeId = Number(attribute.getDataValue("id"));
  createdAttributeIds.push(attributeId);

  for (const value of values) {
    await sequelize.query(
      `
        INSERT INTO attribute_values (attribute_id, value, status, created_at, updated_at)
        VALUES (?, ?, 'active', NOW(), NOW())
      `,
      {
        replacements: [attributeId, value],
      }
    );
  }

  return attributeId;
}

async function login(client: CookieClient, email: string, password: string, label: string) {
  const response = await client.request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  assertStatus(response, 200, label);
}

async function loginAdmin(client: CookieClient) {
  const response = await client.request("/api/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assertStatus(response, 200, "admin login");
}

async function findAttributeRow(attributeId: number) {
  const rows = await sequelize.query<any>(
    `
      SELECT
        id,
        name,
        display_name AS displayName,
        scope,
        store_id AS storeId,
        published,
        status,
        created_by_role AS createdByRole
      FROM attributes
      WHERE id = ?
      LIMIT 1
    `,
    {
      replacements: [attributeId],
      type: QueryTypes.SELECT,
    }
  );
  return rows[0] || null;
}

async function findAttributeValueRows(attributeId: number) {
  return sequelize.query<any>(
    `
      SELECT id, attribute_id AS attributeId, value, status
      FROM attribute_values
      WHERE attribute_id = ?
      ORDER BY id ASC
    `,
    {
      replacements: [attributeId],
      type: QueryTypes.SELECT,
    }
  );
}

async function createFixtureProduct(ownerUserId: number, storeId: number, label: string) {
  const slug = `${RUN_ID}-${label}`.toLowerCase();
  const product = await Product.create({
    name: slug,
    slug,
    sku: slug.toUpperCase(),
    price: 15000,
    salePrice: 12000,
    stock: 9,
    userId: ownerUserId,
    storeId,
    status: "draft",
    isPublished: false,
    sellerSubmissionStatus: "none",
    description: `Fixture ${slug}`,
  } as any);
  const id = Number(product.getDataValue("id"));
  createdProductIds.push(id);
  return { id };
}

async function attachAttributeToProduct(productId: number, attributeId: number, valueId: number) {
  await sequelize.query(
    `
      INSERT INTO product_attribute_values (product_id, attribute_id, attribute_value_id, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `,
    {
      replacements: [productId, attributeId, valueId],
    }
  );
}

async function cleanupFixtures() {
  if (createdProductIds.length > 0) {
    await sequelize.query(
      `DELETE FROM product_attribute_values WHERE product_id IN (${createdProductIds.map(() => "?").join(",")})`,
      {
        replacements: createdProductIds,
        type: QueryTypes.DELETE,
      }
    ).catch(() => null);
  }

  if (createdProductIds.length > 0) {
    await Product.destroy({
      where: { id: createdProductIds } as any,
      force: true,
    } as any).catch(() => null);
  }

  if (createdAttributeIds.length > 0) {
    await sequelize.query(
      `DELETE FROM attribute_values WHERE attribute_id IN (${createdAttributeIds.map(() => "?").join(",")})`,
      {
        replacements: createdAttributeIds,
        type: QueryTypes.DELETE,
      }
    ).catch(() => null);
    await sequelize.query(
      `DELETE FROM attributes WHERE id IN (${createdAttributeIds.map(() => "?").join(",")})`,
      {
        replacements: createdAttributeIds,
        type: QueryTypes.DELETE,
      }
    ).catch(() => null);
  }

  if (createdStoreIds.length > 0) {
    await Store.destroy({ where: { id: createdStoreIds } as any, force: true } as any).catch(() => null);
  }
  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: createdUserIds } as any, force: true } as any).catch(() => null);
  }
}

async function main() {
  await ensureServerReady();

  const seller = await createFixtureUser("seller");
  const otherSeller = await createFixtureUser("other");
  const sellerStore = await createFixtureStore(seller.id, "seller");
  const otherStore = await createFixtureStore(otherSeller.id, "other");

  const globalPublishedName = `${RUN_ID}-global-published`;
  const globalUnpublishedName = `${RUN_ID}-global-hidden`;
  const globalPublishedId = await createGlobalAttribute(globalPublishedName, true, ["alpha", "beta"]);
  await createGlobalAttribute(globalUnpublishedName, false, ["gamma"]);

  const sellerClient = new CookieClient();
  const adminClient = new CookieClient();
  await login(sellerClient, seller.email, seller.password, "seller login");
  await loginAdmin(adminClient);

  logStep("seller list returns global published and store-owned attributes");
  const initialList = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes?keyword=${encodeURIComponent(RUN_ID)}&limit=50`
  );
  assertStatus(initialList, 200, "seller list hybrid attributes");
  const initialItems = Array.isArray(initialList.body?.data) ? initialList.body.data : [];
  assert.ok(
    initialItems.some((item: any) => String(item?.name || "") === globalPublishedName && item?.scope === "global"),
    "published global attribute missing from seller list"
  );
  assert.ok(
    !initialItems.some((item: any) => String(item?.name || "") === globalUnpublishedName),
    "unpublished global attribute leaked into seller list"
  );
  logPass("seller sees only global published plus store-owned attributes");

  logStep("seller create store attribute");
  const createResponse = await sellerClient.request(`/api/seller/stores/${sellerStore.id}/attributes`, {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID}-store-material`,
      displayName: "Store Material",
      type: "dropdown",
      values: ["Cotton", "Linen"],
      published: true,
    }),
  });
  assertStatus(createResponse, 200, "seller create attribute");
  const createdAttribute = createResponse.body?.data;
  const createdAttributeId = Number(createdAttribute?.id || 0);
  assert.ok(createdAttributeId > 0, "created store attribute id missing");
  createdAttributeIds.push(createdAttributeId);
  assert.equal(createdAttribute.scope, "store", "created attribute should be store scope");
  assert.equal(Number(createdAttribute.storeId || 0), sellerStore.id, "created attribute storeId mismatch");
  logPass("seller can create store attribute");

  logStep("seller update own store attribute");
  const updateResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes/${createdAttributeId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        displayName: "Store Material Updated",
        values: ["Cotton", "Wool"],
      }),
    }
  );
  assertStatus(updateResponse, 200, "seller update attribute");
  assert.equal(updateResponse.body?.data?.displayName, "Store Material Updated");
  assert.deepEqual(updateResponse.body?.data?.values, ["Cotton", "Wool"]);
  logPass("seller can update own store attribute");

  logStep("seller cannot edit global attribute");
  const patchGlobalResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes/${globalPublishedId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ displayName: "Should Fail" }),
    }
  );
  assertStatus(patchGlobalResponse, 403, "seller patch global attribute");
  logPass("seller cannot edit global attribute");

  logStep("seller cannot access other store");
  const otherStoreResponse = await sellerClient.request(`/api/seller/stores/${otherStore.id}/attributes`);
  assertStatus(otherStoreResponse, 403, "seller cross-store list");
  logPass("seller cannot access other store");

  logStep("admin can see seller attribute");
  const adminListResponse = await adminClient.request(
    `/api/admin/attributes?scope=store&q=${encodeURIComponent(RUN_ID)}&limit=50`
  );
  assertStatus(adminListResponse, 200, "admin sees seller attributes");
  const adminItems = Array.isArray(adminListResponse.body?.data) ? adminListResponse.body.data : [];
  const adminSellerRow = adminItems.find((item: any) => Number(item?.id || 0) === createdAttributeId);
  assert.ok(adminSellerRow, "admin seller attribute row missing");
  assert.equal(adminSellerRow.scope, "store", "admin seller row scope mismatch");
  logPass("admin sees seller store attribute");

  logStep("seller delete unused store attribute -> hard delete");
  const deleteUnusedResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes/${createdAttributeId}`,
    { method: "DELETE" }
  );
  assertStatus(deleteUnusedResponse, 200, "seller delete unused attribute");
  assert.equal(Boolean(deleteUnusedResponse.body?.archived), false, "unused attribute should hard delete");
  const deletedRow = await findAttributeRow(createdAttributeId);
  assert.equal(deletedRow, null, "unused store attribute should be removed");
  logPass("unused store attribute hard deletes");

  logStep("seller delete used store attribute -> archive");
  const createUsedResponse = await sellerClient.request(`/api/seller/stores/${sellerStore.id}/attributes`, {
    method: "POST",
    body: JSON.stringify({
      name: `${RUN_ID}-store-size`,
      displayName: "Store Size",
      type: "dropdown",
      values: ["S", "M"],
      published: true,
    }),
  });
  assertStatus(createUsedResponse, 200, "seller create used attribute");
  const usedAttributeId = Number(createUsedResponse.body?.data?.id || 0);
  assert.ok(usedAttributeId > 0, "used attribute id missing");
  createdAttributeIds.push(usedAttributeId);

  const usedValues = await findAttributeValueRows(usedAttributeId);
  const usedValueId = Number(usedValues[0]?.id || 0);
  assert.ok(usedValueId > 0, "used attribute value missing");

  const product = await createFixtureProduct(seller.id, sellerStore.id, "used-attr-product");
  await attachAttributeToProduct(product.id, usedAttributeId, usedValueId);

  const deleteUsedResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes/${usedAttributeId}`,
    { method: "DELETE" }
  );
  assertStatus(deleteUsedResponse, 200, "seller delete used attribute");
  assert.equal(Boolean(deleteUsedResponse.body?.archived), true, "used attribute should archive");
  const archivedRow = await findAttributeRow(usedAttributeId);
  assert.equal(archivedRow?.status, "archived", "used store attribute should be archived");
  assert.equal(Boolean(archivedRow?.published), false, "archived store attribute should be unpublished");
  const archivedValues = await findAttributeValueRows(usedAttributeId);
  assert.ok(archivedValues.every((entry) => String(entry.status) === "archived"), "used attribute values should archive");
  logPass("used store attribute archives instead of hard delete");
}

main()
  .then(async () => {
    await cleanupFixtures();
    console.log("[seller-attributes-crud] PASS");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seller-attributes-crud] FAIL", error);
    await cleanupFixtures();
    process.exit(1);
  });
