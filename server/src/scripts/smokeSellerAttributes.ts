import "dotenv/config";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import { QueryTypes } from "sequelize";
import { Attribute, Store, User, sequelize } from "../models/index.js";

const BASE_URL = String(process.env.BASE_URL || "http://localhost:3001").replace(/\/+$/, "");
const DEFAULT_PASSWORD = process.env.MVF_SMOKE_PASSWORD || "mvf-smoke-123";
const RUN_ID = `mvf-seller-attr-${Date.now()}`;

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
const createdAttributeValueIds: number[] = [];

const logStep = (label: string) => console.log(`[seller-attributes] ${label}`);
const logPass = (label: string) => console.log(`[seller-attributes] PASS ${label}`);

const assertStatus = (response: JsonResponse, status: number, label: string) => {
  assert.equal(
    response.status,
    status,
    `${label}: expected HTTP ${status}, received ${response.status} (${response.text})`
  );
};

async function ensureServerReady() {
  const response = await fetch(`${BASE_URL}/api/health`);
  assert.equal(response.ok, true, `[seller-attributes] API not ready at ${BASE_URL}/api/health`);
}

async function createFixtureUser(label: string) {
  const email = `${RUN_ID}-${label}@local.dev`;
  const hashed = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const user = await User.create({
    name: `Seller Attributes ${label}`,
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

async function createAttribute(name: string, published: boolean, values: string[]) {
  const attribute = await Attribute.create({
    name,
    displayName: `${name} display`,
    type: "dropdown",
    published,
  } as any);
  const attributeId = Number(attribute.getDataValue("id"));
  assert.ok(attributeId > 0, "failed to seed attribute");
  createdAttributeIds.push(attributeId);

  for (const value of values) {
    const [_result, meta] = await sequelize.query(
      `
        INSERT INTO attribute_values (attribute_id, value, created_at, updated_at)
        VALUES (?, ?, NOW(), NOW())
      `,
      {
        replacements: [attributeId, value],
      }
    );
    const valueId = Number((meta as any)?.insertId || 0);
    if (valueId > 0) createdAttributeValueIds.push(valueId);
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

async function cleanupFixtures() {
  if (createdAttributeValueIds.length > 0) {
    await sequelize.query(`DELETE FROM attribute_values WHERE id IN (${createdAttributeValueIds.map(() => "?").join(",")})`, {
      replacements: createdAttributeValueIds,
      type: QueryTypes.DELETE,
    });
  }
  if (createdAttributeIds.length > 0) {
    await sequelize.query(`DELETE FROM attributes WHERE id IN (${createdAttributeIds.map(() => "?").join(",")})`, {
      replacements: createdAttributeIds,
      type: QueryTypes.DELETE,
    });
  }
  if (createdStoreIds.length > 0) {
    await Store.destroy({ where: { id: createdStoreIds } as any, force: true } as any);
  }
  if (createdUserIds.length > 0) {
    await User.destroy({ where: { id: createdUserIds } as any, force: true } as any);
  }
}

async function main() {
  await ensureServerReady();

  const seller = await createFixtureUser("seller");
  const otherSeller = await createFixtureUser("other");
  const sellerStore = await createFixtureStore(seller.id, "seller");
  const otherStore = await createFixtureStore(otherSeller.id, "other");

  const publishedName = `${RUN_ID}-published`;
  const unpublishedName = `${RUN_ID}-hidden`;
  await createAttribute(publishedName, true, ["alpha", "beta"]);
  await createAttribute(unpublishedName, false, ["gamma"]);

  const sellerClient = new CookieClient();
  await login(sellerClient, seller.email, seller.password, "seller login");

  logStep("list published attributes");
  const listResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes?keyword=${encodeURIComponent(RUN_ID)}&limit=20`
  );
  assertStatus(listResponse, 200, "seller attributes list");
  const items = Array.isArray(listResponse.body?.data) ? listResponse.body.data : [];
  assert.ok(
    items.some((item: any) => String(item?.name || "") === publishedName),
    "published attribute missing"
  );
  assert.ok(
    !items.some((item: any) => String(item?.name || "") === unpublishedName),
    "unpublished attribute leaked"
  );
  logPass("seller sees only published global attributes");

  logStep("filter by option type");
  const typeResponse = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes?optionType=dropdown&limit=20`
  );
  assertStatus(typeResponse, 200, "seller attributes type filter");
  const typeItems = Array.isArray(typeResponse.body?.data) ? typeResponse.body.data : [];
  assert.ok(
    typeItems.every((item: any) => String(item?.type || "") === "dropdown"),
    "type filter mismatch"
  );
  logPass("option type filter works");

  logStep("export seller attributes csv");
  const exportCsv = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes/export?format=csv&keyword=${encodeURIComponent(RUN_ID)}`
  );
  assertStatus(exportCsv, 200, "seller attributes export csv");
  assert.match(String(exportCsv.headers.get("content-type") || ""), /text\/csv/i);
  assert.match(exportCsv.text, /published/i);
  assert.match(exportCsv.text, new RegExp(publishedName));
  logPass("csv export works");

  logStep("export seller attributes json");
  const exportJson = await sellerClient.request(
    `/api/seller/stores/${sellerStore.id}/attributes/export?format=json&keyword=${encodeURIComponent(RUN_ID)}`
  );
  assertStatus(exportJson, 200, "seller attributes export json");
  assert.match(String(exportJson.headers.get("content-type") || ""), /application\/json/i);
  assert.equal(exportJson.body?.scope, "seller-readonly-global-published-attributes");
  logPass("json export works");

  logStep("cross-store access denied");
  const forbiddenResponse = await sellerClient.request(`/api/seller/stores/${otherStore.id}/attributes`);
  assert.equal(forbiddenResponse.status, 403, `cross-store access should be denied (${forbiddenResponse.text})`);
  logPass("cross-store access denied");
}

main()
  .then(async () => {
    await cleanupFixtures();
    console.log("[seller-attributes] PASS");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("[seller-attributes] FAIL", error);
    await cleanupFixtures();
    process.exit(1);
  });
