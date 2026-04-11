import "dotenv/config";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import app from "../app.js";

type JsonResponse = {
  status: number;
  headers: Headers;
  body: any;
  text: string;
};

const logPass = (label: string) => {
  console.log(`[request-diagnostics] PASS ${label}`);
};

const request = async (baseUrl: string, headers?: HeadersInit): Promise<JsonResponse> => {
  const response = await fetch(`${baseUrl}/api/diagnostics/request-context`, {
    headers,
  });
  const text = await response.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return {
    status: response.status,
    headers: response.headers,
    body,
    text,
  };
};

const closeServer = (server: ReturnType<typeof app.listen>) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const main = async () => {
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const generated = await request(baseUrl);
    assert.equal(generated.status, 200, generated.text);
    assert.equal(generated.body?.ok, true);
    assert.equal(generated.body?.requestIdSource, "generated");
    assert.match(String(generated.body?.requestId || ""), /^req_[0-9a-f-]{36}$/);
    assert.equal(generated.headers.get("x-request-id"), generated.body?.requestId);
    assert.equal(generated.headers.get("x-correlation-id"), generated.body?.correlationId);
    logPass("generated request id");

    const forwarded = await request(baseUrl, {
      "X-Request-Id": "smoke-request-123",
      "X-Correlation-Id": "smoke-correlation-456",
    });
    assert.equal(forwarded.status, 200, forwarded.text);
    assert.equal(forwarded.body?.requestId, "smoke-request-123");
    assert.equal(forwarded.body?.correlationId, "smoke-correlation-456");
    assert.equal(forwarded.body?.requestIdSource, "x-request-id");
    assert.equal(forwarded.headers.get("x-request-id"), "smoke-request-123");
    assert.equal(forwarded.headers.get("x-correlation-id"), "smoke-correlation-456");
    logPass("incoming request/correlation headers respected");

    const correlationOnly = await request(baseUrl, {
      "X-Correlation-Id": "smoke-correlation-only",
    });
    assert.equal(correlationOnly.status, 200, correlationOnly.text);
    assert.equal(correlationOnly.body?.requestId, "smoke-correlation-only");
    assert.equal(correlationOnly.body?.correlationId, "smoke-correlation-only");
    assert.equal(correlationOnly.body?.requestIdSource, "x-correlation-id");
    logPass("correlation header can seed request id");
  } finally {
    await closeServer(server);
  }
};

main().catch((error) => {
  console.error("[request-diagnostics] FAIL", error);
  process.exitCode = 1;
});
