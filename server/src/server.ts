import app from "./app";
import "./models";
import net from "node:net";

const BASE_PORT = Number(process.env.PORT) || 3000;

/**
 * Start the server: connect DB, sync models, then listen with port retry.
 */
const startServer = async () => {
  try {
    console.log("Attempting to connect to the database...");
    const sequelize = (await import("./config/database")).default;
    await sequelize.authenticate();
    console.log("Database connected successfully.");

    console.log("Synchronizing database models...");
    await sequelize.sync({ alter: true });
    console.log("Database synchronized successfully.");

    await listenWithRetry(BASE_PORT, 10);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

// Try to listen on a port; on EADDRINUSE, try the next one up to `retries` times
function listenWithRetry(port: number, retries: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const server = app
      .listen(port)
      .once("listening", () => {
        console.log(`🚀 Server is running on http://localhost:${port} with DB sync`);
        if (port !== BASE_PORT) {
          console.warn(
            `[server] Note: desired PORT ${BASE_PORT} was busy. Using ${port} instead.`
          );
        }
        resolve();
      })
      .once("error", (err: any) => {
        if (err && err.code === "EADDRINUSE" && retries > 0) {
          const next = port + 1;
          console.warn(
            `[server] Port ${port} in use. Retrying on ${next} (${retries - 1} retries left)...`
          );
          setTimeout(() => {
            listenWithRetry(next, retries - 1).then(resolve).catch(reject);
          }, 250);
          return;
        }
        reject(err);
      });
  });
}

