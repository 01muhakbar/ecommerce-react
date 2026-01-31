import app from "./app.js";
import { sequelize, syncDb } from "./models/index.js";

const BASE_PORT = Number(process.env.PORT) || 3001;

/**
 * Start the server: connect DB, sync models, then listen with port retry.
 */
const startServer = async () => {
  try {
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

