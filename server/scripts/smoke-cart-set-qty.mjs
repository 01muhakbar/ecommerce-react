import assert from "node:assert/strict";

const baseUrl = process.env.API_BASE_URL || "http://localhost:3001/api";
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const productIdEnv = process.env.SMOKE_PRODUCT_ID
  ? Number(process.env.SMOKE_PRODUCT_ID)
  : null;

if (!email || !password) {
  console.error(
    "[smoke-cart-set-qty] Missing SMOKE_EMAIL or SMOKE_PASSWORD env vars."
  );
  process.exit(1);
}

const getCookie = (res) => {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  return setCookie.split(";")[0];
};

const request = async (path, options = {}, cookie) => {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });
  return res;
};

const login = async () => {
  const res = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`Login failed: ${res.status} ${await res.text()}`);
  }
  const cookie = getCookie(res);
  if (!cookie) throw new Error("Missing auth cookie from login response.");
  return cookie;
};

const getFirstProductId = async () => {
  if (productIdEnv && Number.isFinite(productIdEnv) && productIdEnv > 0) {
    return productIdEnv;
  }
  const res = await request("/store/products?limit=1", { method: "GET" });
  if (!res.ok) {
    throw new Error(`Fetch products failed: ${res.status} ${await res.text()}`);
  }
  const data = await res.json();
  const first = data?.data?.[0];
  const id = Number(first?.id);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error("No product found for smoke test.");
  }
  return id;
};

const setQty = async (cookie, productId, qty) => {
  const res = await request(
    `/cart/items/${productId}`,
    { method: "PUT", body: JSON.stringify({ qty }) },
    cookie
  );
  if (res.status !== 204 && !res.ok) {
    throw new Error(`Set qty failed: ${res.status} ${await res.text()}`);
  }
};

const getCartQty = async (cookie, productId) => {
  const res = await request("/cart", { method: "GET" }, cookie);
  if (!res.ok) {
    throw new Error(`Get cart failed: ${res.status} ${await res.text()}`);
  }
  const cart = await res.json();
  const products = cart?.Products || [];
  const found = products.find((p) => Number(p?.id) === productId);
  const qty = Number(
    found?.CartItem?.quantity ??
      found?.cartItem?.quantity ??
      found?.quantity ??
      0
  );
  return Number.isFinite(qty) ? qty : 0;
};

const main = async () => {
  const cookie = await login();
  const productId = await getFirstProductId();

  await setQty(cookie, productId, 2);
  assert.equal(await getCartQty(cookie, productId), 2);

  await setQty(cookie, productId, 5);
  assert.equal(await getCartQty(cookie, productId), 5);

  await setQty(cookie, productId, 3);
  assert.equal(await getCartQty(cookie, productId), 3);

  // idempotent: same qty again
  await setQty(cookie, productId, 3);
  assert.equal(await getCartQty(cookie, productId), 3);

  await setQty(cookie, productId, 0);
  assert.equal(await getCartQty(cookie, productId), 0);

  // idempotent remove
  await setQty(cookie, productId, 0);
  assert.equal(await getCartQty(cookie, productId), 0);

  console.log("[smoke-cart-set-qty] OK");
};

main().catch((err) => {
  console.error("[smoke-cart-set-qty] FAILED", err);
  process.exit(1);
});
