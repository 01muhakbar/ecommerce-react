import "dotenv/config";
import { spawn, spawnSync } from "node:child_process";
import mysql from "mysql2/promise";
import type { Connection } from "mysql2/promise";

const PNPM = "pnpm";
const PORT = Number(process.env.PUBLIC_RELEASE_SMOKE_PORT || 3025);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const HEALTH_URL = `${BASE_URL}/api/health`;
const SKIP_BUILD = process.env.PUBLIC_RELEASE_SMOKE_SKIP_BUILD === "true";
const SKIP_APP_SMOKES = process.env.PUBLIC_RELEASE_SMOKE_SKIP_APP_SMOKES === "true";

type CommandEnv = NodeJS.ProcessEnv;

const log = (message: string) => {
  console.log(`[public-release-smoke] ${message}`);
};

const fail = (message: string): never => {
  throw new Error(message);
};

const trimEnv = (key: string, env: CommandEnv = process.env) => String(env[key] || "").trim();

const buildProductionEnv = (): CommandEnv => ({
  ...process.env,
  NODE_ENV: "production",
  PORT: String(PORT),
  BASE_URL,
});

const sanitizeEnv = (env: CommandEnv) =>
  Object.fromEntries(
    Object.entries(env)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, value]) => [key, value])
  );

const validateProductionEnv = (env: CommandEnv) => {
  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const jwtSecret = trimEnv("JWT_SECRET", env);
  const authCookieName = trimEnv("AUTH_COOKIE_NAME", env);
  const databaseUrl = trimEnv("DATABASE_URL", env);
  const dbParts = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASS"];

  if (!jwtSecret) missing.push("JWT_SECRET");
  if (!authCookieName) missing.push("AUTH_COOKIE_NAME");
  if (!databaseUrl) {
    dbParts.forEach((key) => {
      if (!trimEnv(key, env)) missing.push(key);
    });
  }

  if (jwtSecret === "dev-secret") {
    errors.push("JWT_SECRET must not use the development fallback value.");
  } else if (jwtSecret && jwtSecret.length < 24) {
    errors.push("JWT_SECRET must be at least 24 characters long for production.");
  }

  if (trimEnv("COOKIE_SECURE", env) !== "true") {
    warnings.push("COOKIE_SECURE is not true; only acceptable for same-origin/local proof.");
  }
  if (!trimEnv("CLIENT_URL", env) && !trimEnv("CORS_ORIGIN", env)) {
    warnings.push("CLIENT_URL/CORS_ORIGIN is not set; cross-origin production auth may fail.");
  }
  if (
    !trimEnv("PUBLIC_BASE_URL", env) &&
    !trimEnv("CLIENT_PUBLIC_BASE_URL", env) &&
    !trimEnv("STORE_PUBLIC_BASE_URL", env)
  ) {
    warnings.push("No public base URL is configured; hosted checkout redirects may be fragile.");
  }
  if (!trimEnv("UPLOAD_DIR", env)) {
    warnings.push("UPLOAD_DIR is not set; server will use its default uploads directory.");
  }

  warnings.forEach((warning) => log(`WARN ${warning}`));
  if (missing.length > 0) errors.unshift(`Missing required env: ${missing.join(", ")}`);
  if (errors.length > 0) fail(errors.join(" "));
};

const describeDatabaseTarget = (env: CommandEnv) => {
  const databaseUrl = trimEnv("DATABASE_URL", env);
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      return `${url.username || "(no-user)"}@${url.hostname || "(no-host)"}${url.port ? `:${url.port}` : ""}${url.pathname || ""}`;
    } catch {
      return "DATABASE_URL=(invalid URL)";
    }
  }

  return `${trimEnv("DB_USER", env) || "(no-user)"}@${trimEnv("DB_HOST", env) || "(no-host)"}:${trimEnv("DB_PORT", env) || "(no-port)"}/${trimEnv("DB_NAME", env) || "(no-db)"}`;
};

const classifyDatabaseError = (env: CommandEnv, error: any) => {
  const code = String(error?.code || error?.errno || "").trim();
  const message = String(error?.message || error || "").replace(/\s+/g, " ").trim();
  const details = code ? `${code}: ${message}` : message;

  if (code === "ER_ACCESS_DENIED_ERROR") {
    return `DB readiness failed: access denied for ${describeDatabaseTarget(env)}. Verify DB_USER/DB_PASS or DATABASE_URL for the release environment. (${details})`;
  }
  if (code === "ER_BAD_DB_ERROR") {
    return `DB readiness failed: database does not exist for ${describeDatabaseTarget(env)}. Verify DB_NAME or DATABASE_URL database path. (${details})`;
  }
  if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
    return `DB readiness failed: host could not be resolved for ${describeDatabaseTarget(env)}. Verify DB_HOST/DATABASE_URL host and network/DNS. (${details})`;
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return `DB readiness failed: database is not reachable at ${describeDatabaseTarget(env)}. Verify DB_HOST, DB_PORT, firewall, tunnel, or database service status. (${details})`;
  }

  return `DB readiness failed for ${describeDatabaseTarget(env)}. Verify release DB env and connectivity. (${details})`;
};

const assertDatabaseReady = async (env: CommandEnv) => {
  const databaseUrl = trimEnv("DATABASE_URL", env);
  const target = describeDatabaseTarget(env);
  log(`RUN DB readiness preflight for ${target}`);

  let connection: Connection | null = null;
  try {
    connection = databaseUrl
      ? await mysql.createConnection(databaseUrl)
      : await mysql.createConnection({
          host: trimEnv("DB_HOST", env),
          port: Number(trimEnv("DB_PORT", env) || 3306),
          user: trimEnv("DB_USER", env),
          password: trimEnv("DB_PASS", env),
          database: trimEnv("DB_NAME", env),
          connectTimeout: 10_000,
        });
    await connection.query("SELECT 1");
    log(`PASS DB readiness preflight for ${target}`);
  } catch (error) {
    fail(classifyDatabaseError(env, error));
  } finally {
    await connection?.end().catch(() => undefined);
  }
};

const runCommand = (label: string, args: string[], env: CommandEnv) =>
  new Promise<void>((resolve, reject) => {
    log(`RUN ${label}: pnpm ${args.join(" ")}`);
    const child = spawn(PNPM, args, {
      cwd: process.cwd(),
      env: sanitizeEnv(env),
      stdio: "inherit",
      shell: true,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${label} failed with exit code ${code}`));
    });
  });

const waitForHealth = async (getServerExitCode: () => number | null) => {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 45_000) {
    const exitCode = getServerExitCode();
    if (exitCode !== null) {
      fail(`Production process exited before health was ready with code ${exitCode}.`);
    }
    try {
      const response = await fetch(HEALTH_URL);
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok === true && body?.db === "connected") {
        log(`PASS production health ${HEALTH_URL}`);
        return;
      }
      lastError = `HTTP ${response.status} ${JSON.stringify(body)}`;
    } catch (error) {
      lastError = (error as Error)?.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail(`Production health did not become ready at ${HEALTH_URL}: ${lastError}`);
};

const stopProcessTree = (pid: number | undefined) => {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore shutdown failures after smoke completion.
    }
  }
};

const main = async () => {
  const productionEnv = buildProductionEnv();
  validateProductionEnv(productionEnv);
  await assertDatabaseReady(productionEnv);

  if (!SKIP_BUILD) {
    await runCommand("server build", ["-F", "server", "build"], productionEnv);
    await runCommand("client build", ["-F", "client", "build"], productionEnv);
  }

  log(`RUN production boot: pnpm -F server start:prod on ${BASE_URL}`);
  const serverProcess = spawn(PNPM, ["-F", "server", "start:prod"], {
    cwd: process.cwd(),
    env: sanitizeEnv(productionEnv),
    stdio: "inherit",
    shell: true,
    detached: process.platform !== "win32",
  });
  let serverExitCode: number | null = null;
  serverProcess.once("exit", (code) => {
    serverExitCode = code ?? 0;
  });

  try {
    await waitForHealth(() => serverExitCode);
    if (!SKIP_APP_SMOKES) {
      await runCommand(
        "auth session invalidation smoke",
        ["-F", "server", "smoke:auth-session-invalidation"],
        productionEnv
      );
      await runCommand(
        "auth rate limit smoke",
        ["-F", "server", "smoke:auth-rate-limit"],
        productionEnv
      );
      await runCommand(
        "admin public auth smoke",
        ["-F", "server", "smoke:admin-public-auth"],
        productionEnv
      );
      await runCommand("store readiness smoke", ["-F", "server", "smoke:store-readiness"], productionEnv);
      await runCommand(
        "product visibility smoke",
        ["-F", "server", "smoke:product-visibility"],
        productionEnv
      );
      await runCommand("order payment smoke", ["-F", "server", "smoke:order-payment"], productionEnv);
      await runCommand("stripe webhook smoke", ["-F", "server", "smoke:stripe-webhook"], productionEnv);
      await runCommand("frontend visibility smoke", ["qa:mvf:visibility:frontend"], productionEnv);
    }
    log("OK public release smoke gate passed");
  } finally {
    stopProcessTree(serverProcess.pid);
  }
};

main().catch((error) => {
  console.error("[public-release-smoke] FAIL", error);
  process.exitCode = 1;
});
