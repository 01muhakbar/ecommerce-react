import { Router } from "express";
import { syncDatabase } from "../controllers/devController";

const router = Router();

// DANGEROUS: Should only be available in dev environment
router.get("/sync-db", syncDatabase);

export default router;
