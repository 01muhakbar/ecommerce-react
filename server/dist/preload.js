import dotenv from "dotenv";
import path from "path";
// Resolve the .env file path from the current working directory.
// This makes it robust, as long as you run `npm run` from the project root.
const envPath = path.resolve(process.cwd(), ".env");
const result = dotenv.config({ path: envPath });
if (result.error) {
    // It's useful to log if the .env file is not found, but we don't want to crash here.
    // The database initialization will crash later with a more specific message if needed.
    console.warn(`[Preload] Warning: Could not find or load .env file from ${envPath}.`);
    console.warn(`[Preload] ${result.error.message}`);
}
