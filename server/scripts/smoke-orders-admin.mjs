const BASE_URL = process.env.BASE_URL || "http://localhost:3001";
const COOKIE = process.env.ADMIN_COOKIE || "";
const TOKEN = process.env.ADMIN_TOKEN || "";

const headers = { Accept: "application/json" };
if (COOKIE) {
  headers.Cookie = COOKIE;
}
if (TOKEN) {
  headers.Authorization = `Bearer ${TOKEN}`;
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
