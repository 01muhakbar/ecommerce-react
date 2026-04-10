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
    if (jwtSecret === "dev-secret") {
      errors.push("JWT_SECRET must not use the development fallback value.");
    } else if (jwtSecret.length < 24) {
      errors.push("JWT_SECRET must be at least 24 characters long for production.");
    }
  }

  if (!clientUrl && !corsOrigin) {
    warnings.push(
      "CLIENT_URL/CORS_ORIGIN is not set. This is only safe when production is deployed same-origin behind a trusted proxy."
    );
  }

  if (cookieSecure !== "true") {
    warnings.push(
      "COOKIE_SECURE is not set to true. Cross-origin HTTPS cookies will fail and production auth may be weaker than intended."
    );
  }

  if (!publicBaseUrl && !clientPublicBaseUrl && !storePublicBaseUrl) {
    warnings.push(
      "PUBLIC_BASE_URL / CLIENT_PUBLIC_BASE_URL / STORE_PUBLIC_BASE_URL is not set. Stripe checkout redirects will fall back to request origin/host and may be fragile behind proxies."
    );
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

