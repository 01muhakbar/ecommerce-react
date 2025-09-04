import express from "express";
import { syncDatabase } from "../controllers/devController";

const router = express.Router();

// Rute untuk sinkronisasi database (hanya untuk development)
// GET /api/v1/dev/sync-database
router.get("/sync-database", syncDatabase);

export default router;
