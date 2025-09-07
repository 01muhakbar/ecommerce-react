import { Router } from "express";
// FIX: Added .js extension to relative import
import { syncDatabase } from "../controllers/devController.js";

const router = Router();

router.post("/sync-db", syncDatabase);

export default router;
