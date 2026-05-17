const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const COOKIE = process.env.ADMIN_COOKIE || "";
const TOKEN = process.env.ADMIN_TOKEN || "";
const ADMIN_EMAIL =
  process.env.MVF_ADMIN_EMAIL ||
  process.env.SEED_SUPER_EMAIL ||
  process.env.SUPER_ADMIN_EMAIL ||
  "superadmin@local.dev";
const ADMIN_PASSWORD =
  process.env.MVF_ADMIN_PASSWORD ||
  process.env.SEED_SUPER_PASS ||
  process.env.SUPER_ADMIN_PASSWORD ||
  "supersecure123";

const headers = { Accept: "application/json" };
if (COOKIE) {
  headers.Cookie = COOKIE;
}
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
}

async function bootstrapAdminAuth() {
  if (headers.Cookie || headers.Authorization) return;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      [
        "Admin auth is required for smoke:orders.",
        "Set ADMIN_COOKIE or ADMIN_TOKEN, or set MVF_ADMIN_EMAIL and MVF_ADMIN_PASSWORD so the smoke script can log in.",
        "Example: $env:MVF_ADMIN_EMAIL='admin@example.com'; $env:MVF_ADMIN_PASSWORD='...'; pnpm.cmd -F server smoke:orders",
      ].join(" ")
    );
  }

  const res = await fetch(`${BASE_URL}/api/auth/admin/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }),
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }

  if (!res.ok) {
    const err = new Error(
      `Admin login bootstrap failed with HTTP ${res.status}. Check MVF_ADMIN_EMAIL/MVF_ADMIN_PASSWORD or provide ADMIN_COOKIE/ADMIN_TOKEN.`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }

  const setCookie = res.headers.get("set-cookie");
  const cookie = setCookie ? setCookie.split(";")[0] : "";
  if (!cookie) {
    throw new Error(
      "Admin login bootstrap succeeded but no session cookie was returned. Provide ADMIN_COOKIE or ADMIN_TOKEN explicitly."
    );
  }

  headers.Cookie = cookie;
  console.log("[smoke] bootstrapped admin session from configured/default smoke admin credentials");
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${res.statusText}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

async function run() {
  await bootstrapAdminAuth();

  console.log("[smoke] list orders");
  const list = await request("/api/admin/orders?page=1&limit=5");
  const rows = Array.isArray(list?.data) ? list.data : [];
  const first = rows.find((o) => o && o.id) || rows[0];
  if (!first || !first.id) {
    console.log("[smoke] no orders found");
    return;
  }
  const id = first.id;

  console.log(`[smoke] get order ${id}`);
  await request(`/api/admin/orders/${id}`);

  console.log(`[smoke] patch status completed -> delivered for ${id}`);
  await request(`/api/admin/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "completed" }),
  });

  console.log(`[smoke] get order ${id} again`);
  const detail = await request(`/api/admin/orders/${id}`);
  const status = detail?.data?.status ?? detail?.status;
  console.log(`[smoke] status now: ${status || "-"}`);
}

run().catch((err) => {
  console.error("[smoke] failed", err?.message || err);
  if (err?.body) {
    console.error("[smoke] body", err.body);
  }
  process.exit(1);
});
