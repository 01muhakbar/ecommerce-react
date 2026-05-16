import app from "./app.js";
import { sequelize, syncDb } from "./models/index.js";
import { access, mkdir } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import {
  isMultistoreShipmentMvpEnabled,
  isMultistoreShipmentMutationEnabled,
} from "./services/featureFlags.service.js";

const BASE_PORT = Number(process.env.PORT) || 3001;

const trimEnv = (key: string) => String(process.env[key] || "").trim();
const parseEnvList = (...values: string[]) =>
  values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const isLocalOrigin = (value: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(value);
const isHttpOrigin = (value: string) => /^http:\/\//i.test(value);
const isValidHttpOrigin = (value: string) => /^https?:\/\/[^/]+$/i.test(value);
const DEV_SECRET_VALUES = new Set([
  "dev-secret",
  "secret",
  "secretkey",
  "change_me_in_local_dev",
  "change_me_to_a_strong_secret",
  "replace_with_at_least_24_random_characters",
]);

const assertProductionRuntimeEnv = async () => {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = trimEnv("JWT_SECRET");
  const authCookieName = trimEnv("AUTH_COOKIE_NAME");
  const databaseUrl = trimEnv("DATABASE_URL");
  const dbHost = trimEnv("DB_HOST");
  const dbPort = trimEnv("DB_PORT");
  const dbName = trimEnv("DB_NAME");
  const dbUser = trimEnv("DB_USER");
  const dbPass = trimEnv("DB_PASS");
  const clientUrl = trimEnv("CLIENT_URL");
  const corsOrigin = trimEnv("CORS_ORIGIN");
  const cookieSecure = trimEnv("COOKIE_SECURE");
  const publicBaseUrl = trimEnv("PUBLIC_BASE_URL");
  const clientPublicBaseUrl = trimEnv("CLIENT_PUBLIC_BASE_URL");
  const storePublicBaseUrl = trimEnv("STORE_PUBLIC_BASE_URL");
  const uploadDir = path.resolve(process.cwd(), trimEnv("UPLOAD_DIR") || "uploads");
  const corsOrigins = parseEnvList(clientUrl, corsOrigin);
  const publicOrigins = parseEnvList(publicBaseUrl, clientPublicBaseUrl, storePublicBaseUrl);
  const configuredOrigins = [...corsOrigins, ...publicOrigins];
  const localProductionProof = configuredOrigins.length > 0 && configuredOrigins.every(isLocalOrigin);

  if (!jwtSecret) missing.push("JWT_SECRET");
  if (!authCookieName) missing.push("AUTH_COOKIE_NAME");
  if (!databaseUrl) {
    [["DB_HOST", dbHost], ["DB_PORT", dbPort], ["DB_NAME", dbName], ["DB_USER", dbUser], ["DB_PASS", dbPass]].forEach(
      ([key, value]) => {
        if (!value) missing.push(key);
      }
    );
  }

  if (jwtSecret) {
    if (DEV_SECRET_VALUES.has(jwtSecret)) {
      errors.push("JWT_SECRET must not use a development/example value.");
    } else if (jwtSecret.length < 24) {
      errors.push("JWT_SECRET must be at least 24 characters long for production.");
    }
  }

  if (!clientUrl && !corsOrigin) {
    errors.push("CLIENT_URL or CORS_ORIGIN must be set explicitly in production.");
  }

  for (const origin of corsOrigins) {
    if (origin === "*") {
      errors.push("CORS origin wildcard (*) is not allowed in production.");
    } else if (!isValidHttpOrigin(origin)) {
      errors.push(`CORS/CLIENT origin is invalid for production: ${origin}`);
    } else if (isHttpOrigin(origin) && !isLocalOrigin(origin)) {
      errors.push(`CORS/CLIENT origin must use HTTPS in production: ${origin}`);
    }
  }

  if (cookieSecure === "false" && !localProductionProof) {
    errors.push("COOKIE_SECURE must not be false in production. Omit it to auto-secure or set true.");
  } else if (cookieSecure === "false") {
    warnings.push(
      "COOKIE_SECURE=false is only acceptable for localhost production-proof runs. Use Secure cookies for public HTTPS."
    );
  } else if (cookieSecure !== "true") {
    warnings.push(
      "COOKIE_SECURE is not set. Auth cookies will default to Secure in production."
    );
  }

  if (!publicBaseUrl && !clientPublicBaseUrl && !storePublicBaseUrl) {
    warnings.push(
      "PUBLIC_BASE_URL / CLIENT_PUBLIC_BASE_URL / STORE_PUBLIC_BASE_URL is not set. Stripe checkout redirects will fall back to request origin/host and may be fragile behind proxies."
    );
  }

  for (const origin of publicOrigins) {
    if (!/^https?:\/\/[^/]+/i.test(origin)) {
      errors.push(`Public base URL is invalid for production: ${origin}`);
    } else if (isHttpOrigin(origin) && !isLocalOrigin(origin)) {
      errors.push(`Public base URL must use HTTPS in production: ${origin}`);
    }
  }

  if (process.env.DB_SYNC === "true") {
    errors.push("DB_SYNC=true is not allowed during production startup.");
  }

  if (process.env.ENABLE_MULTISTORE_SHIPMENT_MUTATION && !process.env.ENABLE_MULTISTORE_SHIPMENT_MVP) {
    warnings.push(
      "ENABLE_MULTISTORE_SHIPMENT_MUTATION is set while ENABLE_MULTISTORE_SHIPMENT_MVP is implicit. Set both flags explicitly in production."
    );
  }

  if (isMultistoreShipmentMutationEnabled() && !isMultistoreShipmentMvpEnabled()) {
    errors.push(
      "ENABLE_MULTISTORE_SHIPMENT_MUTATION cannot be enabled when ENABLE_MULTISTORE_SHIPMENT_MVP is disabled."
    );
  }

  try {
    await mkdir(uploadDir, { recursive: true });
    await access(uploadDir, fsConstants.W_OK);
  } catch (error) {
    errors.push(
      `Upload directory is not writable for production startup: ${uploadDir} (${(error as Error)?.message || "unknown error"})`
    );
  }

  if (missing.length > 0) {
    errors.unshift(`Missing required production environment variables: ${missing.join(", ")}`);
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      console.warn(`[server][production-warning] ${warning}`);
    });
  }

  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }
};

/**
 * Start the server: connect DB, sync models, then listen with port retry.
 */
const startServer = async () => {
  try {
    await assertProductionRuntimeEnv();
    console.log("Attempting to connect to the database...");
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    const shouldSync = process.env.DB_SYNC === "true";
    if (shouldSync) {
      console.log("Synchronizing database models...");
      await syncDb();
      console.log("Database synchronized successfully.");
    } else {
      console.log("Skipping database sync (set DB_SYNC=true to enable).");
    }

    await listenOnce(BASE_PORT);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Try to listen on a port; on EADDRINUSE, try the next one up to `retries` times
function listenOnce(port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    app
      .listen(port)
      .once("listening", () => {
        console.log(`🚀 Server is running on http://localhost:${port} with DB sync`);
        resolve();
      })
      .once("error", (err: any) => {
        if (err && err.code === "EADDRINUSE") {
          console.error(
            `[server] Port ${port} already in use. Stop the other process or set PORT to a free port.`
          );
          process.exit(1);
        }
        reject(err);
      });
  });
}
